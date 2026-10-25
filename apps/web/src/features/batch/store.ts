import { newId } from '@repo/shared/id';
import { learnSenders, promotedSender } from '#/features/batch/senders';
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
import { serviceText } from '#/features/scan/annex';

export type DraftPhoto = { blob: Blob; width: number; height: number };

export type DraftPatch = Partial<
  Pick<
    DraftParcel,
    | 'reading'
    | 'carrier'
    | 'tracking'
    | 'trackingNorm'
    | 'readName'
    | 'symbols'
    | 'ocrState'
    | 'ocrName'
    | 'ocrLines'
    | 'pieces'
    | 'sender'
    | 'annex'
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
    ocrState: 'pending',
    ocrName: null,
    ocrLines: [],
    pieces: null,
    sender: null,
    annex: null,
  };
  await db.draftParcel.add(draft);
  return draft;
}

export type TypedTracking = {
  carrier: string | null;
  tracking: string;
  trackingNorm: string;
};

/**
 * A number typed by hand, with no photo to read: the draft is already
 * settled, so nothing waits for it and a restart never reads it again.
 */
export function typedDraft(
  batchId: string,
  typed: TypedTracking,
  now = new Date(),
): DraftParcel {
  return {
    id: newId(),
    batchId,
    createdAt: now,
    photoId: null,
    reading: 'typed',
    readName: null,
    symbols: [],
    ocrState: 'skipped',
    ocrName: null,
    ocrLines: [],
    pieces: null,
    sender: null,
    annex: null,
    ...typed,
  };
}

export async function addTypedDraft(
  db: CourrierDatabase,
  draft: DraftParcel,
): Promise<void> {
  await db.draftParcel.add(draft);
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

/** The photos a draft holds: its own, then those of the pieces that joined it. */
export function photoIdsOf(draft: DraftParcel): string[] {
  const ids = draft.pieces?.photoIds ?? [];
  return draft.photoId ? [draft.photoId, ...ids] : ids;
}

/** A draft's photos go with it, the pieces' included. */
export async function deleteDraftPhotos(
  db: CourrierDatabase,
  files: PhotoFiles,
  draft: DraftParcel,
): Promise<void> {
  for (const id of photoIdsOf(draft)) await deletePhoto(db, files, id);
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
  if (draft) await deleteDraftPhotos(db, files, draft);
  return draft;
}

/**
 * "Abandonner ces N colis": the whole batch goes, drafts and photos alike,
 * so the next scan starts clean instead of picking the old pile up again.
 * Rows first, files after, as `undoLast` does.
 */
export async function discardBatch(
  db: CourrierDatabase,
  files: PhotoFiles,
  batchId: string,
): Promise<void> {
  const drafts = await db.transaction(
    'rw',
    [db.draftBatch, db.draftParcel],
    async () => {
      const gone = await listDrafts(db, batchId);
      await db.draftParcel.bulkDelete(gone.map((draft) => draft.id));
      await db.draftBatch.delete(batchId);
      return gone;
    },
  );
  for (const draft of drafts) await deleteDraftPhotos(db, files, draft);
}

export type FinishOptions = { batchId: string; agentId: string; now?: Date };

/**
 * Received when the mailroom can notify it: a carrier, a number and someone
 * to tell. Only a structured code names someone surely enough; a name the
 * OCR guessed leaves the draft to a hand or to the directory.
 */
export function promotedStatus(draft: DraftParcel): LocalParcel['status'] {
  return draft.carrier && draft.tracking && draft.readName
    ? 'recu'
    : 'a_completer';
}

function toParcel(
  draft: DraftParcel,
  { batchId, agentId, now }: Required<FinishOptions>,
  learnedSenderId?: string | null,
): LocalParcel {
  const sender = promotedSender(draft);
  const senderId =
    learnedSenderId === undefined ? (sender?.id ?? null) : learnedSenderId;
  return {
    id: draft.id,
    createdAt: draft.createdAt,
    updatedAt: now,
    deletedAt: null,
    batchId,
    type: 'colis',
    status: promotedStatus(draft),
    statusSeq: 0,
    carrier: draft.carrier,
    tracking: draft.tracking,
    trackingNorm: draft.trackingNorm,
    personId: null,
    contactId: null,
    readName: draft.readName,
    notificationEmail: null,
    department: null,
    senderId,
    senderName: sender?.name ?? null,
    pieceN: draft.pieces ? draft.pieces.read.length : null,
    pieceTotal: draft.pieces?.total ?? null,
    weightKg: draft.annex?.weightKg?.value ?? null,
    carrierService: serviceText(draft.annex),
    reference: draft.annex?.reference?.value ?? null,
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
 * (queued for `sync.push`), with what the sure senders teach the dictionary
 * ahead of them (§4.8), the photos point at their parcel, the drafts go.
 * An empty batch leaves nothing behind. Returns the parcel ids, in order.
 */
export function finishBatch(
  db: CourrierDatabase,
  { batchId, agentId, now = new Date() }: FinishOptions,
): Promise<string[]> {
  return db.transaction(
    'rw',
    [
      db.draftBatch,
      db.draftParcel,
      db.photo,
      db.batch,
      db.parcel,
      db.sender,
      db.senderAccount,
      db.outbox,
    ],
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
      const learned = await learnSenders(db, drafts, now);
      const parcels = drafts.map((draft) =>
        toParcel(draft, options, learned.senderIds.get(draft.id)),
      );
      await commitLocal(
        db,
        {
          upserts: [
            ...learned.upserts,
            { entity: 'batch', row: batch },
            ...parcels.map((row) => ({ entity: 'parcel' as const, row })),
          ],
        },
        { now },
      );
      for (const draft of drafts) {
        for (const photoId of photoIdsOf(draft)) {
          await db.photo.update(photoId, { parcelId: draft.id });
        }
      }
      await db.draftParcel.bulkDelete(drafts.map((draft) => draft.id));
      await db.draftBatch.delete(batchId);
      return parcels.map((parcel) => parcel.id);
    },
  );
}
