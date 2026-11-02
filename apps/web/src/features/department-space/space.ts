import type { HandoverMethod } from '@repo/contract/handover';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  LocalDeposit,
  LocalHandover,
  LocalParcel,
} from '#/features/db/schema';
import { agentNameOf, methodLabel } from '#/features/handover/entry';
import { isPending, latestFirst } from '#/features/parcels/deposit';
import { DAY_MS, formatTime, startOfDay } from '#/features/parcels/model';
import type { SearchEntry } from '#/features/search/search-index';
import { homeBucket } from '#/features/shell/home-counts';

export const SPACE_TABS = ['coming', 'present', 'history'] as const;
export type SpaceTab = (typeof SPACE_TABS)[number];

/**
 * By the status, as the role homes count: a parcel on its way with its e-mail
 * due stays to come, even if the row asks to notify. What is held back or left
 * goes to the history (maquette 10).
 */
export function tabOf(status: string, tour: boolean): SpaceTab {
  const bucket = homeBucket(status, tour);
  return bucket === 'coming' || bucket === 'present' ? bucket : 'history';
}

export type SpaceParcel = {
  parcel: LocalParcel;
  tab: SpaceTab;
  entry: SearchEntry;
  handover?: LocalHandover;
};

export function spaceCounts(parcels: readonly SpaceParcel[]) {
  const counts: Record<SpaceTab, number> = {
    coming: 0,
    present: 0,
    history: 0,
  };
  for (const { tab } of parcels) counts[tab] += 1;
  return counts;
}

export const inTab = (parcels: readonly SpaceParcel[], tab: SpaceTab) =>
  parcels.filter((row) => row.tab === tab);

export const arrivedAt = ({ parcel }: SpaceParcel) =>
  parcel.depositedAt ?? parcel.receivedAt;

export const ARRIVALS = ['all', 'today', 'week'] as const;
export type Arrival = (typeof ARRIVALS)[number];

export function arrivedWithin(at: Date, arrival: Arrival, now: Date): boolean {
  if (arrival === 'all') return true;
  const today = startOfDay(now).getTime();
  return at.getTime() >= (arrival === 'today' ? today : today - 6 * DAY_MS);
}

/** When it left the list of the present: handed over, returned, held back. */
export const closedAt = ({ parcel, handover }: SpaceParcel) =>
  handover?.at ?? parcel.deliveredAt ?? parcel.updatedAt;

export const PERIODS = ['last30', 'all'] as const;
export type Period = (typeof PERIODS)[number];

export function withinPeriod(at: Date, period: Period, now: Date): boolean {
  return (
    period === 'all' ||
    at.getTime() >= startOfDay(now).getTime() - 30 * DAY_MS
  );
}

export const provenBy = (row: SpaceParcel, proof: HandoverMethod | 'all') =>
  proof === 'all' || row.handover?.method === proof;

/** Who took it, in the words of the history. */
export function takenBy(
  { parcel, handover }: SpaceParcel,
  t: TranslateFn,
): string {
  if (parcel.status === 'retourne') return t('departmentSpace.toCarrier');
  if (!handover) return '—';
  return handover.delegateName
    ? t('departmentSpace.colleague', { name: handover.delegateName })
    : handover.recipientName;
}

/** The one line of a closed parcel on the phone. */
export function historyLine(
  row: SpaceParcel,
  t: TranslateFn,
  me?: string,
): string {
  const { handover, parcel } = row;
  if (!handover) return t(`parcel.state.${parcel.status}`);
  const how = methodLabel(handover.method, t);
  return handover.delegateName
    ? t('departmentSpace.line.delegate', {
        name: handover.delegateName,
        how: how.toLowerCase(),
      })
    : t('departmentSpace.line', { how, agent: agentNameOf(handover, t, me) });
}

/** Newest first, for the history. */
export const latestClosedFirst = (rows: readonly SpaceParcel[]) =>
  [...rows].sort((a, b) => closedAt(b).getTime() - closedAt(a).getTime());

export type DepositNotice = {
  title: string;
  description: string;
  action: string;
  /** The deposit to count; left out, the list of those waiting. */
  depositId?: string;
};

/** What the top of the page asks of the department (D24). */
export function depositNotice(
  deposits: readonly LocalDeposit[],
  t: TranslateFn,
): DepositNotice | undefined {
  const pending = latestFirst(deposits.filter(isPending));
  const [first] = pending;
  if (!first) return undefined;
  if (pending.length > 1) {
    return {
      title: t('deposits.home.action', { count: pending.length }),
      description: t('departmentSpace.deposit.description'),
      action: t('departmentSpace.deposit.many'),
    };
  }
  return {
    title: t('departmentSpace.deposit.title', {
      name: first.shuttleName ?? t('deposits.shuttle'),
      count: first.announced,
      time: formatTime(first.postedAt),
    }),
    description: t('departmentSpace.deposit.description'),
    action: t('departmentSpace.deposit.action'),
    depositId: first.id,
  };
}
