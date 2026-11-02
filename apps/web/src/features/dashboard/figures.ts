import type { TranslateFn } from '@repo/shared/i18n';
import { isPending } from '#/features/parcels/deposit';
import type {
  CourrierDatabase,
  LocalDepartment,
  LocalDeposit,
  LocalParcel,
} from '#/features/db/schema';
import {
  loadOpenParcels,
  loadRecipientContext,
} from '#/features/parcels/api/use-parcels';
import {
  DAY_MS,
  firstNotification,
  homeState,
  recipientOf,
} from '#/features/parcels/model';
import { formatWhen } from '#/features/parcels/record';
import { loadReminderDates } from '#/features/parcels/reminders';
import { awaitsPickup } from '#/features/parcels/sections';

export type DashboardCounts = {
  coming: number;
  /** « En souffrance » included, as in the « À retirer » counter of Colis. */
  waiting: number;
  late: number;
  toSettle: number;
};

export type DashboardLine = DashboardCounts & {
  /** Null: no department, or one since deleted. Listed only when it holds something. */
  departmentId: string | null;
  name: string | null;
  /** The oldest deposit the department has yet to count. */
  depositSince: Date | null;
  /** Days from the notice to the handover, over today's handovers. */
  delayDays: number | null;
};

export type DashboardToSettle = {
  id: string;
  name: string;
  department: string | null;
  cause: string;
  since: string;
};

export type DashboardFigures = {
  totals: DashboardCounts & { handedToday: number };
  lines: DashboardLine[];
  toSettle: DashboardToSettle[];
};

const noCounts = (): DashboardCounts => ({
  coming: 0,
  waiting: 0,
  late: 0,
  toSettle: 0,
});

const time = (date: Date) =>
  date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Why it waits, in the order of the page that settles it. */
function causeOf(
  parcel: LocalParcel,
  deposits: readonly LocalDeposit[],
  t: TranslateFn,
): string {
  if (!parcel.departmentId) return t('settlement.cause.noDepartment');
  const gap = deposits
    .filter((row) => row.gap && row.gapParcelIds?.includes(parcel.id))
    .sort(
      (a, b) =>
        (b.confirmedAt?.getTime() ?? 0) - (a.confirmedAt?.getTime() ?? 0),
    )[0];
  if (!gap) return t('settlement.cause.moved');
  return gap.gap === 'left'
    ? t('settlement.cause.left')
    : t('dashboard.cause.missing', { time: time(gap.postedAt) });
}

/**
 * The overview from the rows of this device: the admin pulls the whole company,
 * and the same rules as Colis (`homeState`, `awaitsPickup`) keep both in step.
 */
export async function loadDashboard(
  db: CourrierDatabase,
  now: Date,
  t: TranslateFn,
): Promise<DashboardFigures> {
  const [parcels, departments, deposits] = await Promise.all([
    loadOpenParcels(db, now),
    db.department.filter((row: LocalDepartment) => !row.deletedAt).toArray(),
    db.deposit.filter((row: LocalDeposit) => !row.deletedAt).toArray(),
  ]);
  const [context, dates] = await Promise.all([
    loadRecipientContext(db, parcels),
    loadReminderDates(db, parcels),
  ]);

  const names = new Map(departments.map(({ id, name }) => [id, name]));
  const lineOf = new Map<string | null | undefined, DashboardLine>(
    departments.map(({ id, name }) => [
      id,
      {
        ...noCounts(),
        departmentId: id,
        name,
        depositSince: null,
        delayDays: null,
      },
    ]),
  );
  const orphans: DashboardLine = {
    ...noCounts(),
    departmentId: null,
    name: null,
    depositSince: null,
    delayDays: null,
  };
  const totals = { ...noCounts(), handedToday: 0 };
  const delays = new Map<string, number[]>();
  const toSettle: { at: number; row: DashboardToSettle }[] = [];

  for (const parcel of parcels) {
    const state = homeState(parcel, now, dates, context.tour, context.atScan);
    if (!state) continue;
    const name = names.get(parcel.departmentId ?? '');
    const known = name !== undefined;
    const line = known ? lineOf.get(parcel.departmentId)! : orphans;
    const add = (key: keyof DashboardCounts) => {
      totals[key] += 1;
      line[key] += 1;
    };
    if (parcel.status === 'en_route') add('coming');
    if (awaitsPickup(state)) add('waiting');
    if (state === 'late') add('late');
    if (state === 'toSettle') {
      add('toSettle');
      const { person, contact } = recipientOf(parcel, context);
      toSettle.push({
        at: parcel.updatedAt.getTime(),
        row: {
          id: parcel.id,
          name: person
            ? `${person.firstName} ${person.lastName}`
            : (contact?.name ?? parcel.readName ?? t('settlement.unknown')),
          department: name ?? null,
          cause: causeOf(parcel, deposits, t),
          since: formatWhen(parcel.updatedAt, now, t),
        },
      });
    }
    if (state === 'handedOver') {
      totals.handedToday += 1;
      if (known && parcel.deliveredAt) {
        const days =
          (parcel.deliveredAt.getTime() - firstNotification(parcel).getTime()) /
          DAY_MS;
        delays.set(parcel.departmentId!, [
          ...(delays.get(parcel.departmentId!) ?? []),
          Math.max(0, days),
        ]);
      }
    }
  }

  for (const deposit of deposits) {
    const line = lineOf.get(deposit.departmentId);
    if (!line || !isPending(deposit)) continue;
    if (!line.depositSince || deposit.postedAt < line.depositSince) {
      line.depositSince = deposit.postedAt;
    }
  }
  for (const [id, days] of delays) {
    lineOf.get(id)!.delayDays =
      days.reduce((sum, day) => sum + day, 0) / days.length;
  }

  const held = orphans.coming + orphans.waiting + orphans.toSettle > 0;
  return {
    totals,
    lines: [
      ...[...lineOf.values()].sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', 'fr'),
      ),
      ...(held ? [orphans] : []),
    ],
    toSettle: toSettle.sort((a, b) => a.at - b.at).map(({ row }) => row),
  };
}
