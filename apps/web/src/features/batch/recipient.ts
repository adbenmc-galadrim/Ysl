import { listDrafts, updateDraft } from '#/features/batch/store';
import type { CourrierDatabase, DraftParcel } from '#/features/db/schema';

/** The parcel scanned just before, and the name it carries. */
export type PreviousRecipient = { draft: DraftParcel; name: string };

/**
 * "Même destinataire que le précédent" (F11): the draft that came right
 * before this one in the batch, when it names someone, by a code or by the
 * OCR's guess. Only the one before: several parcels for one person come
 * off the trolley together.
 */
export async function previousNamed(
  db: CourrierDatabase,
  draft: Pick<DraftParcel, 'id' | 'batchId'>,
): Promise<PreviousRecipient | undefined> {
  const drafts = await listDrafts(db, draft.batchId);
  const at = drafts.findIndex((other) => other.id === draft.id);
  const previous = at > 0 ? drafts[at - 1] : undefined;
  const name = previous?.readName ?? previous?.ocrName ?? null;
  return previous && name ? { draft: previous, name } : undefined;
}

/**
 * The agent says the parcel is for the same person: a correction of theirs
 * (§4.3, rank 9), so the name is sure, however the previous parcel got it.
 * False when the draft was undone meanwhile.
 */
export function copyRecipient(
  db: CourrierDatabase,
  draftId: string,
  name: string,
): Promise<boolean> {
  return updateDraft(db, draftId, { readName: name });
}
