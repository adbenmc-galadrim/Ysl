import {
  damageColumns,
  damageOf,
  type DamageReason,
} from '@repo/contract/parcel-damage';
import { newId } from '@repo/shared/id';
import type { DraftPhoto } from '#/features/batch/store';
import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase, LocalPhoto } from '#/features/db/schema';
import type { ParcelEvent } from '@repo/contract/parcel-event';
import type { PhotoFiles } from '#/features/photos/opfs';
import { deletePhoto, savePhoto } from '#/features/photos/store';
import { parcelEvent } from '#/features/parcels/events';
import {
  liveParcel,
  type StatusChangeOptions,
} from '#/features/parcels/status';

/** What « Signaler un dommage » collects. */
export type DamageInput = {
  reason: DamageReason;
  note: string;
  notifyRecipient: boolean;
  carrierReserve: boolean;
};

/**
 * The photos of the damage, files first like every photo (a row without
 * its file is a loss). They stay on this iPhone (D8); a draft's photos get
 * their parcel when the batch is finished. All carry the same date as the
 * reserve, which is how the record tells them from an earlier, lifted one.
 */
export async function saveDamagePhotos(
  db: CourrierDatabase,
  files: PhotoFiles,
  parcelId: string | null,
  photos: readonly DraftPhoto[],
  now: Date,
): Promise<LocalPhoto[]> {
  const saved: LocalPhoto[] = [];
  for (const photo of photos) {
    saved.push(
      await savePhoto(
        db,
        files,
        { id: newId(), parcelId, kind: 'dommage', ...photo },
        now,
      ),
    );
  }
  return saved;
}

/** The `parcel.damaged` event of a reserve, as the history and the e-mail read it. */
export function damagedEvent(
  input: DamageInput,
  photos: number,
): Extract<ParcelEvent, { type: 'parcel.damaged' }> {
  return {
    type: 'parcel.damaged',
    reason: input.reason,
    note: input.note.trim() || null,
    notifyRecipient: input.notifyRecipient,
    carrierReserve: input.carrierReserve,
    photos,
  };
}

/**
 * Sets a reserve on a parcel (zone d'ombre « Colis abîmé »): its photos,
 * then the parcel's columns and the event that tells the history, in one
 * write queued for `sync.push`. A second report replaces the first.
 */
export async function reportDamage(
  db: CourrierDatabase,
  files: PhotoFiles,
  parcelId: string,
  input: DamageInput,
  photos: readonly DraftPhoto[],
  { agentId, now = new Date() }: StatusChangeOptions,
): Promise<void> {
  const parcel = await liveParcel(db, parcelId);
  const saved = await saveDamagePhotos(db, files, parcelId, photos, now);
  try {
    await commitLocal(
      db,
      {
        upserts: [
          {
            entity: 'parcel',
            row: { ...parcel, ...damageColumns({ ...input, at: now }) },
          },
          parcelEvent(parcelId, damagedEvent(input, photos.length), {
            agentId,
            now,
          }),
        ],
      },
      { now },
    );
  } catch (error) {
    for (const photo of saved) await deletePhoto(db, files, photo.id);
    throw error;
  }
}

/**
 * « Lever la réserve »: the parcel is fine after all. The columns go back
 * to none, the history keeps the reserve and its lifting; a reserve can be
 * set again later.
 */
export async function liftDamage(
  db: CourrierDatabase,
  parcelId: string,
  { agentId, now = new Date() }: StatusChangeOptions,
): Promise<void> {
  const parcel = await liveParcel(db, parcelId);
  const damage = damageOf(parcel);
  if (!damage) return;
  await commitLocal(
    db,
    {
      upserts: [
        { entity: 'parcel', row: { ...parcel, ...damageColumns(null) } },
        parcelEvent(
          parcelId,
          { type: 'parcel.damage_lifted', reason: damage.reason },
          { agentId, now },
        ),
      ],
    },
    { now },
  );
}

/** The photos of the reserve the parcel carries now, oldest first. */
export async function findDamagePhotos(
  db: CourrierDatabase,
  parcelId: string,
  since: Date,
): Promise<LocalPhoto[]> {
  return db.photo
    .where('parcelId')
    .equals(parcelId)
    .filter(
      (photo) =>
        photo.kind === 'dommage' &&
        photo.createdAt.getTime() >= since.getTime(),
    )
    .sortBy('createdAt');
}
