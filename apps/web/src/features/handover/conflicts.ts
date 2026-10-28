import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase, LocalHandover } from '#/features/db/schema';
import { standing } from '#/features/handover/delivered';

/** A handover of this iPhone that another one had already recorded. */
export type DeliveryConflict = {
  /** Who the other iPhone handed the parcels to. */
  recipientName: string | null;
  /** The same account on another iPhone, or a colleague. */
  byMe: boolean;
  count: number;
};

const sameTime = (a: unknown, b: Date | null) =>
  b !== null &&
  (a instanceof Date || typeof a === 'string') &&
  new Date(a).getTime() === b.getTime();

async function handoversListing(
  db: CourrierDatabase,
  parcelId: string,
): Promise<LocalHandover[]> {
  return db.handover
    .filter((handover) => handover.parcelIds.includes(parcelId))
    .toArray();
}

/**
 * After a pull: a parcel this iPhone handed over that the server refused
 * (409, another iPhone recorded its handover first) is back as the server
 * holds it, `remis` to someone else. The refused change is settled and
 * leaves the outbox; this iPhone's handover is cancelled once none of its
 * parcels is its own, so it never stands for a parcel it did not hand over
 * (and never blocks the cancellation of the right one). A handover that kept
 * some of its parcels stays as is.
 */
export async function settleDeliveryConflicts(
  db: CourrierDatabase,
  { now = new Date() }: { now?: Date } = {},
): Promise<DeliveryConflict[]> {
  const refused = await db.outbox
    .where('state')
    .equals('rejected')
    .filter((op) => op.entity === 'parcel' && op.patch.status === 'remis')
    .toArray();
  const lost = new Map<
    string,
    { mine: LocalHandover; winner?: LocalHandover; parcels: Set<string> }
  >();
  const settled: number[] = [];
  for (const op of refused) {
    const parcel = await db.parcel.get(op.entityId);
    if (!parcel || parcel.status !== 'remis') continue;
    if (sameTime(op.patch.deliveredAt, parcel.deliveredAt)) continue;
    const listing = (await handoversListing(db, parcel.id)).filter(standing);
    const mine = listing.find((handover) =>
      sameTime(op.patch.deliveredAt, handover.at),
    );
    if (!mine) continue;
    const winner = listing.find((handover) =>
      sameTime(handover.at, parcel.deliveredAt),
    );
    const entry = lost.get(mine.id) ?? { mine, winner, parcels: new Set() };
    entry.parcels.add(parcel.id);
    lost.set(mine.id, entry);
    settled.push(op.seq);
  }
  if (!settled.length) return [];

  const cancelled = [...lost.values()]
    .filter(({ mine, parcels }) =>
      mine.parcelIds.every((parcelId) => parcels.has(parcelId)),
    )
    .map(({ mine }) => ({
      entity: 'handover' as const,
      row: { ...mine, cancelledAt: now },
    }));
  await db.outbox.bulkDelete(settled);
  await commitLocal(db, { upserts: cancelled }, { now });
  return [...lost.values()].map(({ mine, winner, parcels }) => ({
    recipientName: winner?.recipientName ?? null,
    byMe: winner?.agentId === mine.agentId,
    count: parcels.size,
  }));
}
