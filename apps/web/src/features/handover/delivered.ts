import type { HandoverMethod } from '@repo/contract/handover';
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
 * The handovers that list a parcel `remis` by another one: those that lost
 * it to another iPhone, cancelled by the synchronisation or kept for the
 * parcels they did hand over. Their `parcel.delivered` events for it tell a
 * handover that never happened. One an agent undid with a reason did happen:
 * its story stays.
 */
export async function lostHandoverIds(
  db: CourrierDatabase,
  parcel: LocalParcel,
): Promise<Set<string>> {
  if (parcel.status !== 'remis' || !parcel.deliveredAt) return new Set();
  const field = parcel.personId ? 'personId' : 'contactId';
  const id = parcel.personId ?? parcel.contactId;
  if (!id) return new Set();
  const at = parcel.deliveredAt.getTime();
  const lost = await db.handover
    .where(field)
    .equals(id)
    .filter(
      (handover) =>
        handover.parcelIds.includes(parcel.id) &&
        handover.at.getTime() !== at &&
        !handover.cancelReason,
    )
    .toArray();
  return new Set(lost.map((handover) => handover.id));
}

/**
 * The last cancelled handover that listed a parcel: what its record says
 * once no handover stands for it any more.
 */
export async function cancelledHandoverOf(
  db: CourrierDatabase,
  parcel: LocalParcel,
): Promise<LocalHandover | undefined> {
  const field = parcel.personId ? 'personId' : 'contactId';
  const id = parcel.personId ?? parcel.contactId;
  if (!id) return undefined;
  const cancelled = await db.handover
    .where(field)
    .equals(id)
    .filter(
      (handover) =>
        !!handover.cancelledAt &&
        !handover.deletedAt &&
        handover.parcelIds.includes(parcel.id),
    )
    .sortBy('at');
  return cancelled.at(-1);
}

/** « QR vérifié », « code vérifié », « sans vérification ». */
export function proofLabel(method: HandoverMethod, t: TranslateFn): string {
  return t(`handover.how.${method}`);
}
