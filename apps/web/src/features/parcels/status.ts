import {
  type ParcelStatus,
  statusPatch,
  StatusTransitionError,
  stepBackOf,
} from '@repo/contract/parcel-status';
import { commitLocal, MissingRowError } from '#/features/db/commit';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import { parcelEvent } from '#/features/parcels/events';

export type StatusChangeOptions = { agentId: string; now?: Date };

export async function liveParcel(
  db: CourrierDatabase,
  parcelId: string,
): Promise<LocalParcel> {
  const parcel = await db.parcel.get(parcelId);
  if (!parcel || parcel.deletedAt)
    throw new MissingRowError('parcel', parcelId);
  return parcel;
}

/**
 * Moves a parcel along §8.3, forward or back, and queues it for `sync.push`
 * (`commitLocal`); the counter it carries lets the server tell an undo from a
 * stale copy, a pull landing in between included. Leaving `remis` goes through
 * `cancelHandover`, which cancels the handover first in the outbox.
 * The record's history gets the change in the same write. Returns the op id
 * of the parcel.
 */
export async function changeParcelStatus(
  db: CourrierDatabase,
  parcelId: string,
  to: ParcelStatus,
  { agentId, now = new Date() }: StatusChangeOptions,
): Promise<string> {
  const parcel = await liveParcel(db, parcelId);
  const patch = statusPatch(parcel, to, { now, agentId });
  const [opId] = await commitLocal(
    db,
    {
      upserts: [
        { entity: 'parcel', row: { ...parcel, ...patch } },
        parcelEvent(
          parcelId,
          { type: 'parcel.status', from: parcel.status, to },
          { agentId, now },
        ),
      ],
    },
    { now },
  );
  return opId as string;
}

/** Takes back the last step of a parcel (F30): "Annuler la notification"… */
export async function stepBackParcel(
  db: CourrierDatabase,
  parcelId: string,
  options: StatusChangeOptions,
): Promise<string> {
  const parcel = await liveParcel(db, parcelId);
  const to = stepBackOf(parcel);
  if (!to) throw new StatusTransitionError(parcel.status, parcel.status);
  return changeParcelStatus(db, parcelId, to, options);
}

/** What « Supprimer » may take from a selection: a parcel nobody was told about yet. */
export const DELETABLE_STATUSES: readonly ParcelStatus[] = [
  'a_completer',
  'recu',
];

/**
 * « Supprimer » on a selection (F31): every deletable parcel of it in one
 * write, each with its `parcel.deleted`; the others are left as they are.
 * Returns the ids deleted.
 */
export async function deleteParcels(
  db: CourrierDatabase,
  parcelIds: readonly string[],
  { agentId, now = new Date() }: StatusChangeOptions,
): Promise<string[]> {
  const parcels = await db.parcel.bulkGet([...parcelIds]);
  const ids = parcels
    .filter(
      (parcel) =>
        parcel !== undefined &&
        !parcel.deletedAt &&
        DELETABLE_STATUSES.includes(parcel.status),
    )
    .map((parcel) => parcel!.id);
  if (!ids.length) return [];
  await commitLocal(
    db,
    {
      upserts: ids.map((id) =>
        parcelEvent(id, { type: 'parcel.deleted' }, { agentId, now }),
      ),
      deletes: ids.map((id) => ({ entity: 'parcel' as const, id })),
    },
    { now },
  );
  return ids;
}

/**
 * "Supprimer": the parcel goes from every list, here and on the server, but
 * stays in the base with its history (deletes are logical, §8.4).
 */
export async function deleteParcel(
  db: CourrierDatabase,
  parcelId: string,
  { agentId, now = new Date() }: StatusChangeOptions,
): Promise<void> {
  await liveParcel(db, parcelId);
  await commitLocal(
    db,
    {
      upserts: [
        parcelEvent(parcelId, { type: 'parcel.deleted' }, { agentId, now }),
      ],
      deletes: [{ entity: 'parcel', id: parcelId }],
    },
    { now },
  );
}
