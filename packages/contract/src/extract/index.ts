import { type CodeSymbol, type ParsedCode, parseCode } from '../codes';
import { type BarcodeTracking, trackingsInBarcode } from '../tracking/barcode';
import type { TrackingContext } from '../tracking/rules';
import { type TrackingVerdict, validateTracking } from '../tracking/validate';
import { VOTE, type Vote, voteCarrier } from './carrier';
import { CONFIDENCE } from './confidence';
import { canonical, mergeField, type Observation } from './fields';
import type { Extraction, ExtractInput, FieldSource } from './types';

export { CONFIDENCE, combine, levelOf } from './confidence';
export { VOTE } from './carrier';
export { canonical } from './fields';
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

export const extractFields = ({ symbols }: ExtractInput): Extraction => {
  const reads: Read[] = symbols.map((symbol) => ({
    symbol,
    parsed: parseCode(symbol.text, symbol.format),
  }));
  const hint = hintOf(reads);

  const trackings: Observation<string>[] = [];
  const votes: Vote[] = [];
  const recipients: Observation<string>[] = [];
  const senders: Observation<string>[] = [];
  const pieces: Observation<{ index: number; total: number }>[] = [];
  const weights: Observation<number>[] = [];

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
      if (best !== null) {
        const { value, carrier } = best.verdict;
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
      }
      const recipient = partyName(parsed.recipient);
      if (recipient) {
        recipients.push({
          key: canonical(recipient),
          value: recipient,
          source: source(kind, format, CONFIDENCE.structured2d, recipient),
        });
      }
      const sender = partyName(parsed.sender);
      if (sender) {
        senders.push({
          key: canonical(sender),
          value: sender,
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
      if (parsed.weightKg !== undefined) {
        const text = parsed.weightKg.toFixed(2);
        weights.push({
          key: text,
          value: parsed.weightKg,
          source: source(kind, format, CONFIDENCE.structured2d, text),
        });
      }
      continue;
    }
    const best = bestOf(trackingsInBarcode(symbol.text), hint);
    if (best === null) continue;
    const { value, carrier } = best.verdict;
    trackings.push({
      key: value,
      value,
      source: source('1d', format, trackingConfidence(best.verdict), value),
    });
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

  return {
    tracking: mergeField(trackings),
    carrier: voteCarrier(votes),
    recipient: mergeField(recipients),
    sender: mergeField(senders),
    pieces: mergeField(pieces),
    weightKg: mergeField(weights),
    codes: reads.flatMap((r) => (r.parsed ? [r.parsed] : [])),
  };
};
