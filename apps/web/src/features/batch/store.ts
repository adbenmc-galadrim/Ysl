import { newId } from '@repo/shared/id';
import { commitLocal } from '#/features/db/commit';
import type {
  CourrierDatabase,
  DraftBatch,
  DraftParcel,
  LocalBatch,
  LocalParcel,
} from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';
import { deletePhoto, savePhoto } from '#/features/photos/store';

export type DraftPhoto = { blob: Blob; width: number; height: number };

export type DraftPatch = Partial<
  Pick<
    DraftParcel,
    'reading' | 'carrier' | 'tracking' | 'trackingNorm' | 'readName' | 'symbols'
  >
>;

/** The batch left on this device, if any: the agent picks it up. */
export function currentBatch(
  db: CourrierDatabase,
): Promise<DraftBatch | undefined> {
  return db.draftBatch.orderBy('startedAt').last();
}

/** The open batch, or a new one; never two open at once. */
export function openBatch(
  db: CourrierDatabase,
  now = new Date(),
): Promise<DraftBatch> {
  return db.transaction('rw', db.draftBatch, async () => {
    const open = await currentBatch(db);
    if (open) return open;
    const batch: DraftBatch = { id: newId(), startedAt: now };
    await db.draftBatch.add(batch);
    return batch;
  });
}

/**
 * One tap, one parcel: the photo first (a row without its file is a loss),
 * then the draft, before the reader has said anything.
 */
export async function addDraft(
  db: CourrierDatabase,
  files: PhotoFiles,
  batchId: string,
  photo: DraftPhoto | null,
  now = new Date(),
): Promise<DraftParcel> {
  const stored = photo
    ? await savePhoto(
        db,
        files,
        { id: newId(), parcelId: null, kind: 'etiquette', ...photo },
        now,
      )
    : undefined;
  const draft: DraftParcel = {
    id: newId(),
    batchId,
    createdAt: now,
    photoId: stored?.id ?? null,
    reading: 'pending',
    carrier: null,
    tracking: null,
    trackingNorm: null,
    readName: null,
    symbols: [],
  };
  await db.draftParcel.add(draft);
  return draft;
}

/** Fills in what the reader found; false if the draft was undone meanwhile. */
export async function updateDraft(
  db: CourrierDatabase,
  id: string,
  patch: DraftPatch,
): Promise<boolean> {
  return (await db.draftParcel.update(id, patch)) === 1;
}

export function listDrafts(
  db: CourrierDatabase,
  batchId: string,
): Promise<DraftParcel[]> {
  return db.draftParcel.where('batchId').equals(batchId).sortBy('createdAt');
}

export async function lastDraft(
  db: CourrierDatabase,
  batchId: string,
): Promise<DraftParcel | undefined> {
  const drafts = await listDrafts(db, batchId);
  return drafts.at(-1);
}

export function countDrafts(
  db: CourrierDatabase,
  batchId: string,
): Promise<number> {
  return db.draftParcel.where('batchId').equals(batchId).count();
}

/**
 * "Annuler": the last parcel leaves the batch, photo included. Two quick taps
 * take two parcels, not the same one twice: the pick and the delete share a
 * transaction.
 */
export async function undoLast(
  db: CourrierDatabase,
  files: PhotoFiles,
  batchId: string,
): Promise<DraftParcel | undefined> {
  const draft = await db.transaction('rw', db.draftParcel, async () => {
    const last = await lastDraft(db, batchId);
    if (last) await db.draftParcel.delete(last.id);
    return last;
  });
  if (draft?.photoId) await deletePhoto(db, files, draft.photoId);
  return draft;
}

export type FinishOptions = { batchId: string; agentId: string; now?: Date };

/**
 * Received when the mailroom can notify it: a carrier, a number and someone
 * to tell. Until the name is read (OCR, later), every draft needs a hand.
 */
export function promotedStatus(draft: DraftParcel): LocalParcel['status'] {
  return draft.carrier && draft.tracking && draft.readName
    ? 'recu'
    : 'a_completer';
}

function toParcel(
  draft: DraftParcel,
  { batchId, agentId, now }: Required<FinishOptions>,
): LocalParcel {
  return {
    id: draft.id,
    createdAt: draft.createdAt,
    updatedAt: now,
    deletedAt: null,
    batchId,
    type: 'colis',
    status: promotedStatus(draft),
    carrier: draft.carrier,
    tracking: draft.tracking,
    trackingNorm: draft.trackingNorm,
    personId: null,
    contactId: null,
    readName: draft.readName,
    notificationEmail: null,
    department: null,
    senderId: null,
    senderName: null,
    pieceN: null,
    pieceTotal: null,
    weightKg: null,
    carrierService: null,
    reference: null,
    location: null,
    notes: null,
    receivedAt: draft.createdAt,
    receivedBy: agentId,
    validatedAt: null,
    notifiedAt: null,
    lastNotifiedAt: null,
    deliveredAt: null,
    deliveredBy: null,
  };
}

/**
 * "Terminer": the batch and its parcels become server rows in one write
 * (queued for `sync.push`), the photos point at their parcel, the drafts go.
 * An empty batch leaves nothing behind. Returns the parcel ids, in order.
 */
export function finishBatch(
  db: CourrierDatabase,
  { batchId, agentId, now = new Date() }: FinishOptions,
): Promise<string[]> {
  return db.transaction(
    'rw',
    [db.draftBatch, db.draftParcel, db.photo, db.batch, db.parcel, db.outbox],
    async () => {
      const open = await db.draftBatch.get(batchId);
      const drafts = await listDrafts(db, batchId);
      if (!open || drafts.length === 0) {
        await db.draftBatch.delete(batchId);
        return [];
      }
      const options = { batchId, agentId, now };
      const batch: LocalBatch = {
        id: batchId,
        createdAt: open.startedAt,
        updatedAt: now,
        deletedAt: null,
        agentId,
        startedAt: open.startedAt,
        endedAt: now,
        parcelCount: drafts.length,
      };
      const parcels = drafts.map((draft) => toParcel(draft, options));
      await commitLocal(
        db,
        {
          upserts: [
            { entity: 'batch', row: batch },
            ...parcels.map((row) => ({ entity: 'parcel' as const, row })),
          ],
        },
        { now },
      );
      for (const draft of drafts) {
        if (draft.photoId) {
          await db.photo.update(draft.photoId, { parcelId: draft.id });
        }
      }
      await db.draftParcel.bulkDelete(drafts.map((draft) => draft.id));
      await db.draftBatch.delete(batchId);
      return parcels.map((parcel) => parcel.id);
    },
  );
}
