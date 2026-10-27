import { cutoff, RETENTION } from '@repo/contract/retention';
import type {
  CourrierDatabase,
  LocalParcel,
  LocalPhoto,
} from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';
import { deletePhoto, ORPHAN_GRACE_MS } from '#/features/photos/store';

export type LocalPurgeReport = {
  at: Date;
  photos: number;
  extractions: number;
};

/** `sync_state` key of the last local purge (`LocalPurgeReport`). */
export const LOCAL_PURGE_KEY = 'lastLocalPurge';

/** When the parcel left the counter: handed over, or returned to its sender. */
function settledAt(parcel: LocalParcel): Date | null {
  if (parcel.status === 'remis') return parcel.deliveredAt;
  if (parcel.status === 'retourne') return parcel.updatedAt;
  return null;
}

type PhotoContext = {
  parcels: Map<string, LocalParcel>;
  drafts: Set<string>;
  pending: Set<string>;
  now: Date;
};

/**
 * Whether a photo is past its time (§9.2). A label or damage photo goes 7
 * days after its parcel left the counter, once the server holds the parcel
 * (no change of it still queued). A signature goes after 12 months. A photo
 * whose parcel is gone from this iPhone, purged or deleted, goes once it is
 * older than the orphan grace; one still waiting in a batch is kept.
 */
export function photoExpired(
  photo: LocalPhoto,
  { parcels, drafts, pending, now }: PhotoContext,
): boolean {
  if (photo.kind === 'signature') {
    return photo.createdAt < cutoff(now, RETENTION.signature);
  }
  if (photo.parcelId === null) return false;
  const parcel = parcels.get(photo.parcelId);
  if (!parcel || parcel.deletedAt) {
    if (drafts.has(photo.parcelId)) return false;
    return now.getTime() - photo.createdAt.getTime() >= ORPHAN_GRACE_MS;
  }
  const settled = settledAt(parcel);
  return (
    settled !== null &&
    settled < cutoff(now, RETENTION.photo) &&
    !pending.has(parcel.id)
  );
}

/**
 * The purge of this iPhone (§9.2): photos past their time, and what the
 * reader made of labels after 30 days or once their parcel is gone. Rows
 * the server purged leave with the pull; this covers what never goes to
 * the server. Photos go one by one, row then file: a crash in between
 * leaves an orphan file, which the launch sweep removes.
 */
export async function purgeLocal(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  now = new Date(),
): Promise<LocalPurgeReport> {
  const extractionCut = cutoff(now, RETENTION.extraction);
  const parcelIds = new Set(await db.parcel.toCollection().primaryKeys());
  const extractions = await db.extraction
    .filter(
      (row) => row.createdAt < extractionCut || !parcelIds.has(row.parcelId),
    )
    .primaryKeys();
  await db.extraction.bulkDelete(extractions);

  let photos = 0;
  if (files) {
    const stored = await db.photo
      .filter((row) => row.parcelId !== null)
      .toArray();
    const ids = [...new Set(stored.map((row) => row.parcelId!))];
    const found = await db.parcel.bulkGet(ids);
    const parcels = new Map(
      found.flatMap((parcel) => (parcel ? [[parcel.id, parcel]] : [])),
    );
    const drafts = new Set(await db.draftParcel.toCollection().primaryKeys());
    const queued = await db.outbox
      .where('state')
      .equals('queued')
      .filter((op) => op.entity === 'parcel')
      .toArray();
    const pending = new Set(queued.map((op) => op.entityId));
    const context = { parcels, drafts, pending, now };
    for (const photo of await db.photo.toArray()) {
      if (!photoExpired(photo, context)) continue;
      await deletePhoto(db, files, photo.id);
      photos += 1;
    }
  }

  const report = { at: now, photos, extractions: extractions.length };
  await db.syncState.put({ key: LOCAL_PURGE_KEY, value: report });
  return report;
}
