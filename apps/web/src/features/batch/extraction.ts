import type { Field } from '@repo/contract/extract';
import type {
  DraftParcel,
  ExtractionField,
  ExtractionFieldName,
  LocalExtraction,
} from '#/features/db/schema';
import { ocrText } from '#/features/scan/annex';
import { draftFields } from '#/features/scan/confidence';

/** Moves up whenever the rules that score the fields change (§8.2 `version`). */
export const EXTRACTION_VERSION = 1;

const stored = <T>(field: Field<T> | null): ExtractionField | undefined =>
  field === null
    ? undefined
    : {
        value: field.value,
        confidence: field.confidence,
        level: field.level,
        flags: field.flags,
        sources: field.sources,
      };

/** The sender as the draft settled it, with the dictionary the reading had (§4.8). */
const senderOf = (draft: DraftParcel): ExtractionField | undefined => {
  const sender = draft.sender;
  if (!sender) return undefined;
  const confidence = sender.confidence ?? 0;
  return {
    value: sender.name,
    confidence,
    level: sender.level,
    flags: [],
    sources: [
      { kind: sender.source, format: 'sender', confidence, value: sender.name },
    ],
  };
};

/**
 * What the reader made of a draft's label, kept with the parcel it becomes:
 * each field with its sources and confidence as the batch was finished,
 * the codes, the text, the time each step took.
 */
export function extractionOf(draft: DraftParcel, now: Date): LocalExtraction {
  const { extraction, tracking, recipient } = draftFields(draft);
  const fields: Partial<Record<ExtractionFieldName, ExtractionField>> = {
    tracking: stored(tracking),
    carrier: stored(extraction.carrier),
    recipient: stored(recipient),
    sender: senderOf(draft),
    pieces: stored(extraction.pieces),
    weightKg: stored(extraction.weightKg),
    service: stored(extraction.service),
    reference: stored(extraction.reference),
  };
  const text = ocrText(draft.ocrLines);
  return {
    parcelId: draft.id,
    version: EXTRACTION_VERSION,
    fields: Object.fromEntries(
      Object.entries(fields).filter(([, field]) => field !== undefined),
    ),
    codes: draft.symbols,
    ocrText: text === '' ? null : text,
    durations: {
      codesMs: draft.durations?.codesMs ?? null,
      ocrMs: draft.durations?.ocrMs ?? null,
    },
    provenance: 'device',
    createdAt: now,
  };
}
