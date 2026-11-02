import { HANDOVER_METHODS, type HandoverMethod } from '@repo/contract/handover';
import type { TranslateFn } from '@repo/shared/i18n';
import {
  loadDashboard,
  meanDays,
  NO_DEPARTMENT,
  pickupDelayDays,
} from '#/features/dashboard/figures';
import type {
  CourrierDatabase,
  LocalDepartment,
  LocalDeposit,
  LocalHandover,
  LocalParcel,
} from '#/features/db/schema';
import { remindersAfterNotice } from '#/features/parcels/reminders';

export const REPORT_PERIODS = ['week', 'month', 'quarter'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export type PeriodRange = {
  from: Date;
  /** Excluded: the first instant of the next period. */
  to: Date;
};

/** The calendar week (from Monday), month or quarter holding `now`, on this device's clock. */
export function periodRange(period: ReportPeriod, now: Date): PeriodRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (period === 'month') {
    return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) };
  }
  if (period === 'quarter') {
    const first = month - (month % 3);
    return { from: new Date(year, first, 1), to: new Date(year, first + 3, 1) };
  }
  const monday = now.getDate() - ((now.getDay() + 6) % 7);
  return {
    from: new Date(year, month, monday),
    to: new Date(year, month, monday + 7),
  };
}

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

function daysOf({ from, to }: PeriodRange): Date[] {
  const days: Date[] = [];
  for (
    let day = from;
    day < to;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    days.push(day);
  }
  return days;
}

const lastDays = (now: Date, count: number): Date[] =>
  daysOf({
    from: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - count + 1,
    ),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  });

export type ReportFigures = {
  received: number;
  handed: number;
  delayDays: number | null;
  /** As of now, as on the overview: a parcel runs late today, not over a period. */
  late: number;
  gaps: number;
};

export type ReportLine = ReportFigures & {
  /** `NO_DEPARTMENT`: no department, or one since deleted. Listed only when it holds something. */
  id: string;
  name: string | null;
  reminders: number;
  proof: HandoverMethod | null;
};

export type ReportDay = {
  day: Date;
  /** Parcels received that day, in the order of `lines`. */
  received: number[];
};

export type Report = {
  /** The company has never received a parcel. */
  empty: boolean;
  totals: ReportFigures;
  lines: ReportLine[];
  days: ReportDay[];
  /** The last ten days of each line, ending today: the phone's department page. */
  lastDays: Map<string, ReportDay[]>;
  /** What the period's export holds, by line: the parcels received in it. */
  parcelIds: Map<string, string[]>;
};

const inRange = (date: Date | null | undefined, { from, to }: PeriodRange) =>
  Boolean(date && date >= from && date < to);

function mostUsed(counts: ReadonlyMap<HandoverMethod, number>) {
  let best: HandoverMethod | null = null;
  for (const method of HANDOVER_METHODS) {
    if ((counts.get(method) ?? 0) > (best ? counts.get(best)! : 0)) {
      best = method;
    }
  }
  return best;
}

type Tally = {
  received: number;
  handed: number;
  delays: number[];
  reminders: number;
  gaps: number;
  proofs: Map<HandoverMethod, number>;
  parcelIds: string[];
  byDay: Map<string, number>;
};

const newTally = (): Tally => ({
  received: 0,
  handed: 0,
  delays: [],
  reminders: 0,
  gaps: 0,
  proofs: new Map(),
  parcelIds: [],
  byDay: new Map(),
});

/**
 * The reports from the rows of this device, like the overview: the admin pulls
 * the whole company. The delay and « en souffrance » come from the overview's
 * own functions, so both screens give one figure.
 */
export async function loadReport(
  db: CourrierDatabase,
  period: ReportPeriod,
  now: Date,
  t: TranslateFn,
): Promise<Report> {
  const range = periodRange(period, now);
  const [parcels, departments, deposits, handovers, overview] =
    await Promise.all([
      db.parcel.filter((row: LocalParcel) => !row.deletedAt).toArray(),
      db.department.filter((row: LocalDepartment) => !row.deletedAt).toArray(),
      db.deposit.filter((row: LocalDeposit) => !row.deletedAt).toArray(),
      db.handover
        .filter((row: LocalHandover) => !row.deletedAt && !row.cancelledAt)
        .toArray(),
      loadDashboard(db, now, t),
    ]);

  const known = new Set(departments.map(({ id }) => id));
  const tallies = new Map<string, Tally>(
    [...known, NO_DEPARTMENT].map((id) => [id, newTally()]),
  );
  const tallyOf = (departmentId: string | null | undefined) =>
    tallies.get(
      departmentId && known.has(departmentId) ? departmentId : NO_DEPARTMENT,
    )!;

  const notified = new Map<string, Date>();
  const byId = new Map<string, LocalParcel>();
  for (const parcel of parcels) {
    byId.set(parcel.id, parcel);
    if (parcel.notifiedAt) notified.set(parcel.id, parcel.notifiedAt);
    const tally = tallyOf(parcel.departmentId);
    const key = dayKey(parcel.receivedAt);
    tally.byDay.set(key, (tally.byDay.get(key) ?? 0) + 1);
    if (inRange(parcel.receivedAt, range)) {
      tally.received += 1;
      tally.parcelIds.push(parcel.id);
    }
    if (
      parcel.status === 'remis' &&
      parcel.deliveredAt &&
      inRange(parcel.deliveredAt, range)
    ) {
      tally.handed += 1;
      tally.delays.push(pickupDelayDays(parcel, parcel.deliveredAt));
    }
  }

  const reminders = await remindersAfterNotice(db, notified);
  for (const [parcelId, dates] of reminders) {
    tallyOf(byId.get(parcelId)?.departmentId).reminders += dates.filter((at) =>
      inRange(at, range),
    ).length;
  }

  for (const deposit of deposits) {
    if (deposit.gap && inRange(deposit.confirmedAt, range)) {
      tallyOf(deposit.departmentId).gaps += 1;
    }
  }

  for (const row of handovers) {
    if (!inRange(row.at, range)) continue;
    for (const parcelId of row.parcelIds) {
      const parcel = byId.get(parcelId);
      if (!parcel) continue;
      const { proofs } = tallyOf(parcel.departmentId);
      proofs.set(row.method, (proofs.get(row.method) ?? 0) + 1);
    }
  }

  const lateOf = new Map(
    overview.lines.map((line) => [
      line.departmentId ?? NO_DEPARTMENT,
      line.late,
    ]),
  );
  const toLine = (id: string, name: string | null): ReportLine => {
    const tally = tallies.get(id)!;
    return {
      id,
      name,
      received: tally.received,
      handed: tally.handed,
      delayDays: meanDays(tally.delays),
      late: lateOf.get(id) ?? 0,
      gaps: tally.gaps,
      reminders: tally.reminders,
      proof: mostUsed(tally.proofs),
    };
  };
  const named = departments
    .map(({ id, name }) => toLine(id, name))
    .sort(
      (a, b) =>
        b.received - a.received ||
        (a.name ?? '').localeCompare(b.name ?? '', 'fr'),
    );
  const orphans = toLine(NO_DEPARTMENT, null);
  const lines =
    orphans.received +
      orphans.handed +
      orphans.late +
      orphans.gaps +
      orphans.reminders >
    0
      ? [...named, orphans]
      : named;

  const dayRows = (days: Date[], ids: string[]): ReportDay[] =>
    days.map((day) => ({
      day,
      received: ids.map((id) => tallies.get(id)!.byDay.get(dayKey(day)) ?? 0),
    }));

  const sum = (pick: (line: ReportLine) => number) =>
    lines.reduce((total, line) => total + pick(line), 0);

  return {
    empty: parcels.length === 0,
    totals: {
      received: sum((line) => line.received),
      handed: sum((line) => line.handed),
      delayDays: meanDays(
        [...tallies.values()].flatMap((tally) => tally.delays),
      ),
      late: overview.totals.late,
      gaps: sum((line) => line.gaps),
    },
    lines,
    days: dayRows(
      daysOf(range),
      lines.map(({ id }) => id),
    ),
    lastDays: new Map(
      lines.map(({ id }) => [id, dayRows(lastDays(now, 10), [id])]),
    ),
    parcelIds: new Map(lines.map(({ id }) => [id, tallies.get(id)!.parcelIds])),
  };
}
