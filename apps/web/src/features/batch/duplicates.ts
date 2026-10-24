import type {
  CourrierDatabase,
  DraftParcel,
  LocalParcel,
} from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';
import { deletePhoto } from '#/features/photos/store';

/** The parcel a label was already read as: in this batch, or received before. */
export type Duplicate =
  | { kind: 'batch'; draft: DraftParcel }
  | { kind: 'parcel'; parcel: LocalParcel };

export type DuplicateQuery = Pick<
  DraftParcel,
  'id' | 'batchId' | 'createdAt' | 'trackingNorm'
>;

/**
 * The parcel this draft doubles, if any (F10): an older draft of the batch
 * with the same normalized number, else the latest parcel received with it,
 * from any batch and any device, as long as it was not deleted. Only an
 * older draft counts: two readings of the same label landing together must
 * not take each other out. No number, no duplicate.
 */
export async function findDuplicate(
  db: CourrierDatabase,
  draft: DuplicateQuery,
): Promise<Duplicate | null> {
  if (!draft.trackingNorm) return null;
  const drafts = await db.draftParcel
    .where('trackingNorm')
    .equals(draft.trackingNorm)
    .filter(
      (other) =>
        other.id !== draft.id &&
        other.batchId === draft.batchId &&
        other.createdAt < draft.createdAt,
    )
    .sortBy('createdAt');
  const original = drafts[0];
  if (original) return { kind: 'batch', draft: original };
  const parcels = await db.parcel
    .where('trackingNorm')
    .equals(draft.trackingNorm)
    .filter((parcel) => parcel.deletedAt === null)
    .sortBy('receivedAt');
  const parcel = parcels.at(-1);
  return parcel ? { kind: 'parcel', parcel } : null;
}

/**
 * "Ce colis n'a pas été ajouté une deuxième fois": the draft leaves the batch
 * (count, last added) but keeps its photo, so "Ajouter quand même" can put it
 * back as it was. Undefined when it was undone meanwhile.
 */
export async function holdDraft(
  db: CourrierDatabase,
  id: string,
): Promise<DraftParcel | undefined> {
  return db.transaction('rw', db.draftParcel, async () => {
    const draft = await db.draftParcel.get(id);
    if (draft) await db.draftParcel.delete(id);
    return draft;
  });
}

/** "Ajouter quand même": the held draft rejoins the batch, same id, same photo. */
export async function restoreDraft(
  db: CourrierDatabase,
  draft: DraftParcel,
): Promise<void> {
  await db.draftParcel.put(draft);
}

/** The held draft is given up: its photo goes, the sweep would not take it. */
export async function dropHeld(
  db: CourrierDatabase,
  files: PhotoFiles,
  draft: DraftParcel,
): Promise<void> {
  if (draft.photoId) await deletePhoto(db, files, draft.photoId);
}
