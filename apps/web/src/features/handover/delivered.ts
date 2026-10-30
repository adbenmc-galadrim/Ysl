import type { HandoverMethod } from '@repo/contract/handover';
import {
  PARCEL_EVENT_ENTITY,
  readParcelEvent,
} from '@repo/contract/parcel-event';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  CourrierDatabase,
  LocalHandover,
  LocalParcel,
} from '#/features/db/schema';

/** The handover that stands for a parcel: neither cancelled nor deleted. */
export const standing = (handover: LocalHandover) =>
  !handover.cancelledAt && !handover.deletedAt;

/**
 * The standing handover of each parcel handed over, by parcel id: the one
 * that wrote its `deliveredAt`, so a handover that lost the parcel to another
 * iPhone (kept for the parcels it did hand over) never names it; the latest
 * otherwise. Read through the recipients' handovers: the parcel ids are not
 * indexed on this iPhone.
 */
export async function handoversOf(
  db: CourrierDatabase,
  parcels: readonly LocalParcel[],
): Promise<Map<string, LocalHandover>> {
  const delivered = parcels.filter((parcel) => parcel.status === 'remis');
  const personIds = [
    ...new Set(delivered.flatMap((parcel) => parcel.personId ?? [])),
  ];
  const contactIds = [
    ...new Set(delivered.flatMap((parcel) => parcel.contactId ?? [])),
  ];
  if (!personIds.length && !contactIds.length) return new Map();
  const handovers = (
    await Promise.all([
      db.handover.where('personId').anyOf(personIds).toArray(),
      db.handover.where('contactId').anyOf(contactIds).toArray(),
    ])
  )
    .flat()
    .filter(standing)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const deliveredAt = new Map(
    delivered.map((parcel) => [parcel.id, parcel.deliveredAt?.getTime()]),
  );
  const byParcel = new Map<string, LocalHandover>();
  for (const handover of handovers) {
    for (const parcelId of handover.parcelIds) {
      if (!deliveredAt.has(parcelId)) continue;
      const held = byParcel.get(parcelId);
      const wrote = handover.at.getTime() === deliveredAt.get(parcelId);
      if (!held || wrote || held.at.getTime() !== deliveredAt.get(parcelId)) {
        byParcel.set(parcelId, handover);
      }
    }
  }
  return byParcel;
}

/**
 * The handovers an agent undid for this parcel, told by its own events: only
 * the parcels a handover did hand over get one, so they are the handovers
 * that truly gave it, whatever else they list.
 */
async function undoneHandoverIds(
  db: CourrierDatabase,
  parcelId: string,
): Promise<Set<string>> {
  const events = await db.event
    .where('[entity+entityId]')
    .equals([PARCEL_EVENT_ENTITY, parcelId])
    .toArray();
  return new Set(
    events.flatMap((row) => {
      const event = readParcelEvent(row.type, row.detail);
      return event?.type === 'parcel.handover_cancelled'
        ? [event.handoverId]
        : [];
    }),
  );
}

/**
 * The handovers that list a parcel without having given it: they lost it to
 * another iPhone, cancelled by the synchronisation or kept for the parcels
 * they did hand over. Their `parcel.delivered` events for it tell a handover
 * that never happened. One undone for this parcel did happen, and the one
 * that wrote its `deliveredAt` holds it.
 */
export async function lostHandoverIds(
  db: CourrierDatabase,
  parcel: LocalParcel,
): Promise<Set<string>> {
  const field = parcel.personId ? 'personId' : 'contactId';
  const id = parcel.personId ?? parcel.contactId;
  if (!id) return new Set();
  const at = parcel.deliveredAt?.getTime();
  const [listing, undone] = await Promise.all([
    db.handover
      .where(field)
      .equals(id)
      .filter((handover) => handover.parcelIds.includes(parcel.id))
      .toArray(),
    undoneHandoverIds(db, parcel.id),
  ]);
  return new Set(
    listing
      .filter(
        (handover) => handover.at.getTime() !== at && !undone.has(handover.id),
      )
      .map((handover) => handover.id),
  );
}

/**
 * The cancelled handover a parcel's record tells once none stands for it: the
 * last one an agent undid for this parcel, else the last that listed it.
 */
export async function cancelledHandoverOf(
  db: CourrierDatabase,
  parcel: LocalParcel,
): Promise<LocalHandover | undefined> {
  const field = parcel.personId ? 'personId' : 'contactId';
  const id = parcel.personId ?? parcel.contactId;
  if (!id) return undefined;
  const [cancelled, undone] = await Promise.all([
    db.handover
      .where(field)
      .equals(id)
      .filter(
        (handover) =>
          !!handover.cancelledAt &&
          !handover.deletedAt &&
          handover.parcelIds.includes(parcel.id),
      )
      .sortBy('at'),
    undoneHandoverIds(db, parcel.id),
  ]);
  return (
    cancelled.filter((handover) => undone.has(handover.id)).at(-1) ??
    cancelled.at(-1)
  );
}

/** « QR vérifié », « code vérifié », « sans vérification ». */
export function proofLabel(method: HandoverMethod, t: TranslateFn): string {
  return t(`handover.how.${method}`);
}
