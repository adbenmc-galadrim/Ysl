import { isParcelComplete } from '@repo/contract/parcel-completion';
import {
  type Extraction,
  extractFields,
  type Field,
  type FieldSource,
  levelOf,
  scoreTrackingValue,
} from '@repo/contract/extract';
import type { DraftParcel } from '#/features/db/schema';
import { ocrText } from '#/features/scan/annex';
import { recipientInCodes } from '#/features/scan/extract';

/** What the agent typed, chose or confirmed (§4.3 rank 9). */
export const AGENT_CONFIDENCE = 1;

export type DraftFields = {
  extraction: Extraction;
  /** The draft's own number, with how surely it was read. */
  tracking: Field<string> | null;
  /** The recipient the draft names, settled or read. */
  recipient: Field<string> | null;
};

type Readable = Pick<
  DraftParcel,
  | 'reading'
  | 'symbols'
  | 'ocrLines'
  | 'ocrName'
  | 'tracking'
  | 'trackingNorm'
  | 'readName'
  | 'recipient'
  | 'trackingConfirmed'
  | 'learnedRecipient'
>;

const agent = (value: string): Field<string> => {
  const source: FieldSource = {
    kind: 'agent',
    format: 'agent',
    confidence: AGENT_CONFIDENCE,
    value,
  };
  return {
    value,
    confidence: AGENT_CONFIDENCE,
    level: 'sure',
    sources: [source],
    flags: [],
    candidates: [{ value, confidence: AGENT_CONFIDENCE, sources: [source] }],
  };
};

/**
 * The tracking the draft keeps, scored by the rules of
 * `@repo/contract/extract`: its own candidate when the reading proposed
 * several, so the level always goes with the number shown.
 */
export function scoreTracking(
  value: string | null,
  read: Field<string> | null,
  confirmed = false,
): Field<string> | null {
  if (value === null) return read;
  if (confirmed) return agent(value);
  if (read?.value === value) return read;
  const candidate = read?.candidates.find((c) => c.value === value);
  if (!candidate) return scoreTrackingValue(value, 'draft');
  return {
    ...read!,
    value,
    confidence: candidate.confidence,
    level: levelOf(candidate.confidence),
    sources: candidate.sources,
    flags: [],
  };
}

/**
 * The recipient: a card settled (by the agent, or silently on an exact
 * code name) or a name the agent copied (« Même destinataire ») is sure;
 * otherwise what the codes and the OCR read, with the checks of §4.3.
 */
function recipientOf(
  draft: Readable,
  read: Field<string> | null,
): Field<string> | null {
  if (draft.recipient) return agent(draft.recipient.name);
  const copied =
    draft.readName !== null &&
    draft.readName !== recipientInCodes(draft.symbols);
  if (copied) return agent(draft.readName!);
  return read;
}

/** Every field of a draft with its confidence, as §4.3 and §4.4 score it. */
export function draftFields(
  draft: Readable,
  directory: readonly string[] = [],
): DraftFields {
  const text = ocrText(draft.ocrLines);
  const extraction = extractFields({
    symbols: draft.symbols,
    ocr:
      text === '' && !draft.ocrName
        ? null
        : { text, recipientName: draft.ocrName },
    directory,
    recipients: draft.learnedRecipient ? [draft.learnedRecipient] : null,
  });
  return {
    extraction,
    tracking: scoreTracking(
      draft.trackingNorm ?? draft.tracking,
      extraction.tracking,
      draft.reading === 'typed' || draft.trackingConfirmed === true,
    ),
    recipient: recipientOf(draft, extraction.recipient),
  };
}

/**
 * F26: a parcel is notified only when its tracking and its recipient are
 * sure (≥ 0,90) or confirmed by the agent, and someone is there to tell: a
 * card of the directory or a contact settled. A name a code prints alone
 * may be a company's; otherwise it waits, « À compléter ». A parcel
 * « Sans suivi » has the app's own number: only its recipient counts.
 */
export function notifiable(
  draft: Readable & Pick<DraftParcel, 'carrier' | 'type'>,
) {
  const type = draft.type ?? 'colis';
  const complete = isParcelComplete({
    type,
    carrier: draft.carrier,
    tracking: draft.trackingNorm ?? draft.tracking,
    recipient: Boolean(draft.recipient),
  });
  if (!complete) return false;
  const { tracking, recipient } = draftFields(draft);
  return (
    (type === 'sans_suivi' || tracking?.level === 'sure') &&
    recipient?.level === 'sure'
  );
}
