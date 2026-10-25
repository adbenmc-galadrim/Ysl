import {
  type ParcelStatus,
  statusPatch,
  StatusTransitionError,
  stepBackOf,
} from '@repo/contract/parcel-status';
import { commitLocal, MissingRowError } from '#/features/db/commit';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';

export type StatusChangeOptions = { agentId: string; now?: Date };

async function liveParcel(
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
 * stale copy, a pull landing in between included. Leaving `remis` also needs
 * its handover cancelled first in the outbox (the handover screen, YSL-75).
 * Returns the op id.
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
    { upserts: [{ entity: 'parcel', row: { ...parcel, ...patch } }] },
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
