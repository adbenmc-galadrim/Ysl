import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadDashboard, NO_DEPARTMENT } from '#/features/dashboard/figures';
import type {
  CourrierDatabase,
  LocalDepartment,
  LocalDeposit,
  LocalHandover,
  LocalNotification,
} from '#/features/db/schema';
import {
  carrierVolumes,
  loadReport,
  periodRange,
} from '#/features/reports/figures';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const STUDIO = 'dep-studio';
const FINANCE = 'dep-finance';
const at = (day: number, hour = 9, month = 9) =>
  new Date(2026, month, day, hour);

describe('periodRange', () => {
  it('runs a week from Monday, a month and a quarter by the calendar', () => {
    // 24 October 2026 is a Saturday.
    expect(periodRange('week', NOW)).toEqual({
      from: at(19, 0),
      to: at(26, 0),
    });
    expect(periodRange('month', NOW)).toEqual({
      from: at(1, 0),
      to: at(1, 0, 10),
    });
    expect(periodRange('quarter', NOW)).toEqual({
      from: at(1, 0),
      to: new Date(2027, 0, 1),
    });
  });

  it('takes Sunday into the week that began the Monday before', () => {
    expect(periodRange('week', at(25)).from).toEqual(at(19, 0));
  });
});

describe('loadReport', () => {
  let db: CourrierDatabase;

  beforeEach(async () => {
    db = await openTestDatabase();
    await db.department.bulkPut([
      { id: STUDIO, name: 'Studio', deletedAt: null },
      { id: FINANCE, name: 'Finance', deletedAt: null },
      { id: 'dep-gone', name: 'Parti', deletedAt: at(1) },
    ] as LocalDepartment[]);
  });

  const handed = (departmentId: string, notified: Date, delivered: Date) =>
    parcelRow({
      departmentId,
      status: 'remis',
      receivedAt: notified,
      notifiedAt: notified,
      deliveredAt: delivered,
    });

  it('gives every figure of a known set, by department and in total', async () => {
    const one = handed(STUDIO, at(5), at(6));
    const two = handed(STUDIO, at(10), at(13));
    const three = handed(FINANCE, at(12), at(12));
    const lastMonth = handed(FINANCE, at(20, 9, 8), at(21, 9, 8));
    const crossing = handed(STUDIO, at(29, 9, 8), at(1, 9));
    const waiting = parcelRow({
      departmentId: FINANCE,
      status: 'recu',
      receivedAt: at(23),
    });
    const removed = parcelRow({
      departmentId: STUDIO,
      receivedAt: at(23),
      deletedAt: at(23),
    });
    await db.parcel.bulkPut([
      one,
      two,
      three,
      lastMonth,
      crossing,
      waiting,
      removed,
    ]);
    await db.notification.bulkPut([
      {
        id: 'sent',
        parcelIds: [one.id],
        sentAt: at(5, 12),
        deletedAt: null,
        deliveryStatus: null,
      },
      {
        id: 'bounced',
        parcelIds: [one.id],
        sentAt: at(5, 13),
        deletedAt: null,
        deliveryStatus: 'bounced',
      },
    ] as unknown as LocalNotification[]);
    await db.deposit.bulkPut([
      {
        id: 'gap',
        departmentId: STUDIO,
        gap: 'missing',
        confirmedAt: at(7),
        deletedAt: null,
      },
      {
        id: 'clean',
        departmentId: STUDIO,
        gap: null,
        confirmedAt: at(7),
        deletedAt: null,
      },
      {
        id: 'old-gap',
        departmentId: FINANCE,
        gap: 'left',
        confirmedAt: at(7, 9, 8),
        deletedAt: null,
      },
    ] as unknown as LocalDeposit[]);
    const handover = (
      id: string,
      parcelIds: string[],
      method: LocalHandover['method'],
      cancelledAt: Date | null = null,
    ) =>
      ({
        id,
        parcelIds,
        method,
        at: at(13),
        cancelledAt,
        deletedAt: null,
      }) as unknown as LocalHandover;
    await db.handover.bulkPut([
      handover('h1', [one.id], 'pin'),
      handover('h2', [two.id], 'pin'),
      handover('h3', [crossing.id], 'qr'),
      handover('h4', [one.id, two.id, crossing.id], 'qr', at(13)),
      handover('h5', [three.id], 'signature'),
    ]);

    const report = await loadReport(db, 'month', NOW, t);

    expect(report.empty).toBe(false);
    expect(report.lines.map((line) => line.name)).toEqual([
      'Finance',
      'Studio',
    ]);
    const [finance, studio] = report.lines;
    expect(studio).toMatchObject({
      received: 2,
      handed: 3,
      reminders: 1,
      gaps: 1,
      proof: 'pin',
    });
    // 1 day, 3 days, 2 days.
    expect(studio!.delayDays).toBeCloseTo(2);
    expect(finance).toMatchObject({
      received: 2,
      handed: 1,
      delayDays: 0,
      reminders: 0,
      gaps: 0,
      proof: 'signature',
    });
    expect(report.totals).toMatchObject({ received: 4, handed: 4, gaps: 1 });
    expect(report.totals.delayDays).toBeCloseTo(1.5);
    expect(new Set(report.parcelIds.get(STUDIO))).toEqual(
      new Set([one.id, two.id]),
    );
    expect(report.days).toHaveLength(31);
    expect(report.days[4]!.received).toEqual([0, 1]);
    expect(report.days[11]!.received).toEqual([1, 0]);
  });

  it('agrees with the overview on the delay of the day and on late parcels', async () => {
    const late = parcelRow({
      departmentId: STUDIO,
      status: 'notifie',
      receivedAt: at(1),
      notifiedAt: at(1),
    });
    await db.parcel.bulkPut([
      handed(STUDIO, at(20), new Date(NOW.getTime() - 3_600_000)),
      handed(STUDIO, at(23), new Date(NOW.getTime() - 7_200_000)),
      late,
    ]);

    const overview = await loadDashboard(db, NOW, t);
    // A week holding only today's handovers: the same parcels on both screens.
    const report = await loadReport(db, 'week', NOW, t);
    const lineOf = overview.lines.find((row) => row.departmentId === STUDIO)!;
    const studio = report.lines.find((row) => row.id === STUDIO)!;

    expect(overview.totals.late).toBeGreaterThan(0);
    expect(report.totals.late).toBe(overview.totals.late);
    expect(studio.late).toBe(lineOf.late);
    expect(studio.delayDays).toBeCloseTo(lineOf.delayDays!);
  });

  it('lists parcels of a deleted department apart, so the lines add up', async () => {
    await db.parcel.bulkPut([
      parcelRow({ departmentId: 'dep-gone', receivedAt: at(23) }),
      parcelRow({ departmentId: null, receivedAt: at(23) }),
      parcelRow({ departmentId: STUDIO, receivedAt: at(23) }),
    ]);
    const report = await loadReport(db, 'month', NOW, t);
    expect(report.lines.at(-1)).toMatchObject({
      id: NO_DEPARTMENT,
      name: null,
      received: 2,
    });
    expect(report.totals.received).toBe(3);
  });

  it('says when the company has no parcel yet, and keeps its departments', async () => {
    const report = await loadReport(db, 'month', NOW, t);
    expect(report.empty).toBe(true);
    expect(report.lines).toHaveLength(2);
    expect(report.totals.delayDays).toBeNull();
  });

  it('counts the first instant of a period, not that of the next', async () => {
    await db.parcel.bulkPut([
      parcelRow({ departmentId: STUDIO, receivedAt: at(1, 0) }),
      parcelRow({
        departmentId: STUDIO,
        receivedAt: new Date(at(1, 0).getTime() - 1),
      }),
      parcelRow({ departmentId: STUDIO, receivedAt: at(1, 0, 10) }),
    ]);
    const report = await loadReport(db, 'month', NOW, t);
    expect(report.totals.received).toBe(1);
  });

  it('adds up the carriers of the lines shown, the busiest first', async () => {
    await db.parcel.bulkPut([
      parcelRow({ departmentId: STUDIO, carrier: 'UPS', receivedAt: at(23) }),
      parcelRow({ departmentId: STUDIO, carrier: 'DHL', receivedAt: at(23) }),
      parcelRow({ departmentId: FINANCE, carrier: 'DHL', receivedAt: at(23) }),
      parcelRow({
        departmentId: FINANCE,
        carrier: 'DHL',
        receivedAt: at(2, 9, 8),
      }),
    ]);
    const report = await loadReport(db, 'month', NOW, t);
    expect(carrierVolumes(report, [STUDIO, FINANCE])).toEqual([
      { carrier: 'DHL', received: 2 },
      { carrier: 'UPS', received: 1 },
    ]);
    expect(carrierVolumes(report, [FINANCE])).toEqual([
      { carrier: 'DHL', received: 1 },
    ]);
  });

  it('counts the last ten days up to today', async () => {
    await db.parcel.bulkPut([
      parcelRow({ departmentId: STUDIO, receivedAt: at(24, 8) }),
      parcelRow({ departmentId: STUDIO, receivedAt: at(15) }),
      parcelRow({ departmentId: STUDIO, receivedAt: at(14) }),
    ]);
    const report = await loadReport(db, 'week', NOW, t);
    const days = report.lastDays.get(STUDIO)!;
    expect(days).toHaveLength(10);
    expect(days.map((row) => row.received[0])).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ]);
  });
});
