import {
  type CarrierService,
  type CodeSymbol,
  carrierService,
  type ParsedCode,
  parseCode,
  serviceOfTracking,
} from '../codes';
import { type BarcodeTracking, trackingsInBarcode } from '../tracking/barcode';
import type { TrackingContext } from '../tracking/rules';
import { type TrackingVerdict, validateTracking } from '../tracking/validate';
import { VOTE, type Vote, voteCarrier } from './carrier';
import { CONFIDENCE } from './confidence';
import { capUnkeyed, mergeField, type Observation } from './fields';
import { type AccountRead, accountsOf, extractSender } from './sender';
import { observeOcr, ocrTrackings, plausibleWeight, weightKey } from './ocr';
import { extractRecipientField, type RecipientRead } from './recipient';
import type { Extraction, ExtractInput, Field, FieldSource } from './types';

export { CONFIDENCE, combine, levelOf } from './confidence';
export {
  elsewhere,
  extractRecipient,
  extractRecipientField,
} from './recipient';
export type { RecipientCard, RecipientField, RecipientRead } from './recipient';
export { aliasKey, bestAlias, LEARNED, learnedConfidence } from './learning';
export type { KnownRecipientAlias, KnownSenderAlias } from './learning';
export { VOTE } from './carrier';
export { adjust, canonical, capUnkeyed } from './fields';
export { explainField, sourceRank } from './explain';
export type { Adjustment, AdjustmentKind, Explanation } from './explain';
export {
  ACCOUNT_CONFIRMED,
  accountKey,
  carrierKey,
  extractSender,
  KNOWN_SENDER_SIMILARITY,
} from './sender';
export type {
  AccountRead,
  KnownAccount,
  KnownSender,
  SenderField,
  SenderInput,
  SenderKnowledge,
} from './sender';
export { observeOcr, ocrTrackings, plausibleWeight } from './ocr';
export type {
  Candidate,
  ConfidenceLevel,
  Extraction,
  ExtractInput,
  Field,
  FieldFlag,
  FieldSource,
  OcrInput,
  SourceKind,
} from './types';

type Read = { symbol: CodeSymbol; parsed: ParsedCode | null };

type Validated = { verdict: TrackingVerdict; found: BarcodeTracking };

const TWO_D = new Set(['Aztec', 'DataMatrix', 'MaxiCode', 'PDF417', 'QRCode']);

/** A sure number first, and among equals the one that names its carrier. */
const rank = (verdict: TrackingVerdict) =>
  (verdict.status === 'sure' ? 0 : 2) + (verdict.carrier === null ? 1 : 0);

/** A number foreign to the hinted carrier still speaks for its own (§4.5). */
const validate = (
  found: BarcodeTracking,
  context: TrackingContext | undefined,
): TrackingVerdict => {
  const verdict = validateTracking(found.value, {
    context: found.context ?? context,
  });
  return verdict.reason === 'context-mismatch' && found.context === undefined
    ? validateTracking(found.value)
    : verdict;
};

/** One tracking per symbol: the candidates of a code are alternatives, not votes. */
const bestOf = (
  trackings: readonly BarcodeTracking[],
  context: TrackingContext | undefined,
): Validated | null => {
  let best: Validated | null = null;
  for (const found of trackings) {
    const verdict = validate(found, context);
    if (verdict.status === 'rejected') continue;
    if (best === null || rank(verdict) < rank(best.verdict)) {
      best = { verdict, found };
    }
  }
  return best;
};

/** §4.3 ranks 2, 4 and 7: keyed, format only, or just a code of unknown shape. */
const trackingConfidence = (verdict: TrackingVerdict) => {
  if (verdict.status === 'sure') return CONFIDENCE.keyed1d;
  return verdict.reason === 'unknown-format'
    ? CONFIDENCE.unvalidated
    : CONFIDENCE.format1d;
};

/** Rank 1 asks a field « cohérent avec la structure attendue » : its format too. */
const structuredConfidence = (verdict: TrackingVerdict) =>
  verdict.status === 'sure' ? CONFIDENCE.structured2d : CONFIDENCE.format1d;

/** A shape several carriers use names its carrier less surely than a 1Z does. */
const sharedFormat = (verdict: TrackingVerdict) =>
  verdict.status !== 'sure' ||
  verdict.candidates.some(
    (c) =>
      c.status !== 'rejected' &&
      c.carrier !== null &&
      c.carrier !== verdict.carrier,
  );

const source = (
  kind: FieldSource['kind'],
  format: string,
  confidence: number,
  value: string,
): FieldSource => ({ kind, format, confidence, value });

const partyName = (party: { name?: string; company?: string } | undefined) =>
  party?.name ?? party?.company;

const hintOf = (reads: readonly Read[]): TrackingContext | undefined => {
  const carriers = new Set(
    reads.flatMap((r) => (r.parsed?.carrier ? [r.parsed.carrier] : [])),
  );
  return carriers.size === 1 ? [...carriers][0] : undefined;
};

/**
 * A number on its own, typed or kept without the code that gave it: scored
 * by its format and key alone, as a 1D code would be (O1 included).
 */
export const scoreTrackingValue = (
  value: string,
  format = 'value',
): Field<string> => {
  const verdict = validateTracking(value);
  const confidence =
    verdict.status === 'rejected'
      ? CONFIDENCE.unvalidated
      : trackingConfidence(verdict);
  const keyed = new Set(verdict.reason === 'valid-key' ? [verdict.value] : []);
  return capUnkeyed(
    mergeField([
      {
        key: verdict.value,
        value: verdict.value,
        source: source('1d', format, confidence, verdict.value),
      },
    ]),
    keyed,
  )!;
};

export const extractFields = ({
  symbols,
  ocr,
  senders,
  directory,
  recipients: learnedRecipients,
  reception,
}: ExtractInput): Extraction => {
  const reads: Read[] = symbols.map((symbol) => ({
    symbol,
    parsed: parseCode(symbol.text, symbol.format),
  }));
  const hint = hintOf(reads);

  const trackings: Observation<string>[] = [];
  const votes: Vote[] = [];
  const keyed = new Set<string>();
  const recipients: RecipientRead[] = [];
  const named: { name: string; source: FieldSource }[] = [];
  const accounts: AccountRead[] = [];
  const pieces: Observation<{ index: number; total: number }>[] = [];
  const weights: Observation<number>[] = [];
  const services: Observation<CarrierService>[] = [];
  const references: Observation<string>[] = [];

  const serviceOf = (
    kind: FieldSource['kind'],
    format: string,
    confidence: number,
    service: CarrierService,
  ) => {
    const text = service.label ?? service.code ?? '';
    services.push({
      key: text,
      value: service,
      source: source(kind, format, confidence, text),
    });
  };
  const derivedService = (
    format: string,
    verdict: TrackingVerdict,
    carrier: TrackingContext | null,
  ) => {
    if (verdict.status !== 'sure') return;
    const service = serviceOfTracking(verdict.value, carrier);
    if (service !== null) serviceOf('1d', format, CONFIDENCE.derived, service);
  };

  for (const { symbol, parsed } of reads) {
    const { format } = symbol;
    const kind = TWO_D.has(format) ? '2d' : '1d';
    if (parsed !== null) {
      if (parsed.carrier !== null) {
        votes.push({
          carrier: parsed.carrier,
          weight: VOTE.structured2d,
          source: source(kind, format, CONFIDENCE.structured2d, parsed.carrier),
        });
      }
      const best = bestOf(parsed.trackings, parsed.carrier ?? hint);
      accounts.push(...accountsOf(parsed, best?.verdict ?? null));
      if (best !== null) {
        const { value, carrier } = best.verdict;
        if (best.verdict.status === 'sure') keyed.add(value);
        trackings.push({
          key: value,
          value,
          source: source(
            kind,
            format,
            structuredConfidence(best.verdict),
            value,
          ),
        });
        if (parsed.carrier === null && carrier !== null) {
          votes.push({
            carrier,
            weight: VOTE.keyedTracking,
            source: source(kind, format, CONFIDENCE.derived, carrier),
          });
        }
        if (parsed.service === undefined) {
          derivedService(format, best.verdict, parsed.carrier ?? carrier);
        }
      }
      const recipient = partyName(parsed.recipient);
      if (recipient) {
        recipients.push({
          name: recipient,
          source: source(kind, format, CONFIDENCE.structured2d, recipient),
          party: parsed.recipient,
        });
      }
      const sender = partyName(parsed.sender);
      if (sender) {
        named.push({
          name: sender,
          source: source(kind, format, CONFIDENCE.structured2d, sender),
        });
      }
      if (parsed.pieces) {
        const text = `${parsed.pieces.index}/${parsed.pieces.total}`;
        pieces.push({
          key: text,
          value: parsed.pieces,
          source: source(kind, format, CONFIDENCE.structured2d, text),
        });
      }
      if (parsed.weightKg !== undefined && plausibleWeight(parsed.weightKg)) {
        const text = parsed.weightKg.toFixed(2);
        weights.push({
          key: weightKey(parsed.weightKg),
          value: parsed.weightKg,
          source: source(kind, format, CONFIDENCE.structured2d, text),
        });
      }
      if (parsed.service !== undefined) {
        serviceOf(
          kind,
          format,
          CONFIDENCE.structured2d,
          carrierService(parsed.carrier, parsed.service),
        );
      }
      if (parsed.reference !== undefined) {
        references.push({
          key: parsed.reference,
          value: parsed.reference,
          source: source(
            kind,
            format,
            CONFIDENCE.structured2d,
            parsed.reference,
          ),
        });
      }
      continue;
    }
    const best = bestOf(trackingsInBarcode(symbol.text), hint);
    if (best === null) continue;
    accounts.push(...accountsOf(null, best.verdict));
    const { value, carrier } = best.verdict;
    if (best.verdict.reason === 'valid-key') keyed.add(value);
    trackings.push({
      key: value,
      value,
      source: source('1d', format, trackingConfidence(best.verdict), value),
    });
    derivedService(format, best.verdict, carrier);
    if (carrier !== null) {
      const shared = sharedFormat(best.verdict);
      votes.push({
        carrier,
        weight: shared ? VOTE.formatOnly : VOTE.keyedTracking,
        source: source(
          '1d',
          format,
          shared ? CONFIDENCE.format1d : CONFIDENCE.derived,
          carrier,
        ),
      });
    }
  }

  const sender = extractSender({
    named,
    accounts,
    ocrName: ocr?.senderName ?? null,
    knowledge: senders,
  });
  const carrier = voteCarrier(votes);
  if (ocr?.recipientName) {
    recipients.push({
      name: ocr.recipientName,
      source: source('ocr', 'block', CONFIDENCE.ocrFormat, ocr.recipientName),
    });
  }
  if (ocr?.text) {
    const read = observeOcr(ocr.text, carrier?.value ?? null);
    const context = carrier?.level === 'sure' ? carrier.value : null;
    const printed = ocrTrackings(ocr.text, context);
    const coded = new Set(trackings.map((t) => t.key));
    for (const { keyed: isKeyed, ...found } of printed) {
      const kept =
        coded.size > 0 ? coded.has(found.key) : isKeyed || context !== null;
      if (!kept) continue;
      if (isKeyed) keyed.add(found.value);
      trackings.push(found);
    }
    pieces.push(...read.pieces);
    weights.push(...read.weights);
    services.push(...read.services);
    references.push(...read.references);
  }

  const recipient = extractRecipientField(
    recipients,
    directory ?? [],
    learnedRecipients ?? [],
    reception ?? null,
  );
  return {
    tracking: capUnkeyed(mergeField(trackings), keyed),
    carrier,
    recipient: recipient.field,
    recipientCard: recipient.card,
    sender: sender.field,
    senderId: sender.senderId,
    senderAlias: sender.alias,
    accounts,
    pieces: mergeField(pieces),
    weightKg: mergeField(weights),
    service: mergeField(services),
    reference: mergeField(references),
    codes: reads.flatMap((r) => (r.parsed ? [r.parsed] : [])),
  };
};
