import { Dexie } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import type { CourrierDatabase } from '#/features/db/schema';

/** Where a parcel's own change stands when it has not reached the server. */
export type PendingParcel = 'unsent' | 'rejected';

const NONE: ReadonlyMap<string, PendingParcel> = new Map();

/**
 * The parcels changed on this iPhone and not taken by the server yet. A
 * refused change outweighs a queued one: it will not leave by itself.
 */
export async function listPendingParcels(
  database: CourrierDatabase,
): Promise<ReadonlyMap<string, PendingParcel>> {
  const ops = await database.outbox
    .where('[entity+entityId]')
    .between(['parcel', Dexie.minKey], ['parcel', Dexie.maxKey])
    .toArray();
  const pending = new Map<string, PendingParcel>();
  for (const op of ops) {
    if (op.state === 'rejected') pending.set(op.entityId, 'rejected');
    else if (!pending.has(op.entityId)) pending.set(op.entityId, 'unsent');
  }
  return pending;
}

export function usePendingParcels(): ReadonlyMap<string, PendingParcel> {
  return useLiveQuery(() => listPendingParcels(db), [], NONE);
}
