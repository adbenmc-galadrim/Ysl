import {
  PARCEL_STATUSES,
  type ParcelStatus,
} from '@repo/contract/parcel-status';

export type HomeCounts = { coming: number; present: number; toSettle: number };

/**
 * Where a parcel stands for the role homes. A status added to the contract
 * must be placed here. `recu` counts as present: until the tour exists, a
 * parcel received is at its department.
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

export function homeCounts(rows: readonly { status: string }[]): HomeCounts {
  const counts: HomeCounts = { coming: 0, present: 0, toSettle: 0 };
  for (const { status } of rows) {
    if (!(PARCEL_STATUSES as readonly string[]).includes(status)) continue;
    const bucket = BUCKET[status as ParcelStatus];
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}
