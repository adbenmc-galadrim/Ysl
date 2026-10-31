import {
  PARCEL_STATUSES,
  type ParcelStatus,
} from '@repo/contract/parcel-status';

export type HomeCounts = { coming: number; present: number; toSettle: number };

/**
 * Where a parcel stands for the role homes. A status added to the contract
 * must be placed here. `recu` counts as present where the shuttle acts as
 * department. With a tour, a parcel not yet deposited is still to come.
 */
const BUCKET: Record<ParcelStatus, keyof HomeCounts | null> = {
  en_route: 'coming',
  a_completer: 'present',
  recu: 'present',
  depose: 'present',
  notifie: 'present',
  a_regulariser: 'toSettle',
  remis: null,
  retourne: null,
};

const NOT_THERE_YET: readonly ParcelStatus[] = ['a_completer', 'recu'];

export function homeCounts(
  rows: readonly { status: string }[],
  tour = false,
): HomeCounts {
  const counts: HomeCounts = { coming: 0, present: 0, toSettle: 0 };
  for (const { status } of rows) {
    if (!(PARCEL_STATUSES as readonly string[]).includes(status)) continue;
    const bucket =
      tour && NOT_THERE_YET.includes(status as ParcelStatus)
        ? 'coming'
        : BUCKET[status as ParcelStatus];
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}
