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
 * The standing handover of each parcel handed over, by parcel id; the
 * latest when a cancelled one was redone. Read through the recipients'
 * handovers: the parcel ids are not indexed on this iPhone.
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
  const wanted = new Set(delivered.map((parcel) => parcel.id));
  const byParcel = new Map<string, LocalHandover>();
  for (const handover of handovers) {
    for (const parcelId of handover.parcelIds) {
      if (wanted.has(parcelId)) byParcel.set(parcelId, handover);
    }
  }
  return byParcel;
}

/** « QR vérifié », « code vérifié », « sans vérification ». */
export function proofLabel(method: HandoverMethod, t: TranslateFn): string {
  return t(`handover.how.${method}`);
}
