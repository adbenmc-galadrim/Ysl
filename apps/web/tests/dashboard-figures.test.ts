import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadDashboard } from '#/features/dashboard/figures';
import type {
  CourrierDatabase,
  LocalDepartment,
  LocalDeposit,
} from '#/features/db/schema';
import { listHomeParcels } from '#/features/parcels/api/use-parcels';
import { counters } from '#/features/parcels/sections';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const OLD = new Date(2026, 9, 5, 9, 0);
const THIS_MORNING = new Date(2026, 9, 24, 9, 40);
const TWO_DAYS_AGO = new Date(2026, 9, 22, 12, 0);

const STUDIO = 'dep-studio';
const FINANCE = 'dep-finance';
const GONE = 'dep-gone';

const departmentRow = (
  id: string,
  name: string,
  deletedAt: Date | null = null,
) => ({ id, name, deletedAt }) as LocalDepartment;

const depositRow = (overrides: Partial<LocalDeposit>) =>
  ({
    id: crypto.randomUUID(),
    createdAt: OLD,
    updatedAt: OLD,
    deletedAt: null,
    departmentId: STUDIO,
    shuttleId: 'shuttle',
    parcelIds: [],
    announced: 1,
    postedAt: THIS_MORNING,
    counted: null,
    gap: null,
    gapParcelIds: null,
    confirmedAt: null,
    ...overrides,
  }) as LocalDeposit;

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
  const lea = personRow({ firstName: 'Léa', lastName: 'Fontaine' });
  await db.directoryPerson.put(lea);
  await db.department.bulkPut([
    departmentRow(STUDIO, 'Studio'),
    departmentRow(FINANCE, 'Finance'),
    departmentRow(GONE, 'Ancien', OLD),
  ]);
  await db.parcel.bulkPut([
    parcelRow({ status: 'en_route', departmentId: STUDIO }),
    parcelRow({ status: 'en_route', departmentId: STUDIO }),
    parcelRow({ status: 'en_route', departmentId: FINANCE }),
    parcelRow({ status: 'depose', departmentId: STUDIO }),
    parcelRow({
      status: 'notifie',
      departmentId: STUDIO,
      notifiedAt: NOW,
    }),
    parcelRow({
      status: 'notifie',
      departmentId: FINANCE,
      notifiedAt: OLD,
    }),
    parcelRow({
      id: 'settle-1',
      status: 'a_regulariser',
      departmentId: FINANCE,
      personId: lea.id,
      updatedAt: THIS_MORNING,
    }),
    parcelRow({
      status: 'remis',
      departmentId: STUDIO,
      notifiedAt: TWO_DAYS_AGO,
      deliveredAt: NOW,
    }),
    parcelRow({
      status: 'remis',
      departmentId: STUDIO,
      notifiedAt: OLD,
      deliveredAt: OLD,
    }),
    parcelRow({ status: 'notifie', departmentId: GONE, notifiedAt: NOW }),
    parcelRow({ status: 'notifie', departmentId: null, notifiedAt: NOW }),
    parcelRow({
      status: 'notifie',
      departmentId: STUDIO,
      notifiedAt: NOW,
      deletedAt: NOW,
    }),
    parcelRow({ status: 'recu', departmentId: STUDIO }),
    parcelRow({ status: 'a_completer', departmentId: STUDIO }),
  ]);
  await db.deposit.bulkPut([
    depositRow({ postedAt: THIS_MORNING }),
    depositRow({ postedAt: NOW }),
    depositRow({ departmentId: FINANCE, confirmedAt: NOW, counted: 1 }),
    depositRow({
      departmentId: FINANCE,
      postedAt: THIS_MORNING,
      confirmedAt: NOW,
      counted: 0,
      gap: 'missing',
      gapParcelIds: ['settle-1'],
    }),
  ]);
});

describe('loadDashboard', () => {
  it('counts each column for the company', async () => {
    const { totals } = await loadDashboard(db, NOW, t);
    expect(totals).toEqual({
      coming: 3,
      waiting: 5,
      late: 1,
      toSettle: 1,
      handedToday: 1,
    });
  });

  it('counts each column by department, and only there', async () => {
    const { lines } = await loadDashboard(db, NOW, t);
    expect(
      lines.map(({ name, coming, waiting, late, toSettle }) => [
        name,
        coming,
        waiting,
        late,
        toSettle,
      ]),
    ).toEqual([
      ['Finance', 1, 1, 1, 1],
      ['Studio', 2, 2, 0, 0],
      [null, 0, 2, 0, 0],
    ]);
  });

  it('adds up to the totals, with no parcel lost to a missing department', async () => {
    const { lines, totals } = await loadDashboard(db, NOW, t);
    const sum = (key: 'coming' | 'waiting' | 'late' | 'toSettle') =>
      lines.reduce((all, line) => all + line[key], 0);
    expect(sum('coming')).toBe(totals.coming);
    expect(sum('waiting')).toBe(totals.waiting);
    expect(sum('late')).toBe(totals.late);
    expect(sum('toSettle')).toBe(totals.toSettle);
  });

  it('says the same as the counters of Colis', async () => {
    const { totals } = await loadDashboard(db, NOW, t);
    const shown = counters(await listHomeParcels(db, NOW), null);
    const count = (id: string) => shown.find((row) => row.id === id)?.count;
    expect(totals.waiting).toBe(count('waiting'));
    expect(totals.late).toBe(count('late'));
  });

  it('dates the oldest deposit left to count, and today’s delay', async () => {
    const { lines } = await loadDashboard(db, NOW, t);
    const studio = lines.find((line) => line.departmentId === STUDIO)!;
    const finance = lines.find((line) => line.departmentId === FINANCE)!;
    expect(studio.depositSince).toEqual(THIS_MORNING);
    expect(finance.depositSince).toBeNull();
    expect(studio.delayDays).toBeCloseTo(2);
    expect(finance.delayDays).toBeNull();
  });

  it('names who is to settle and why', async () => {
    const { toSettle } = await loadDashboard(db, NOW, t);
    expect(toSettle).toMatchObject([
      {
        id: 'settle-1',
        name: 'Léa Fontaine',
        department: 'Finance',
        cause: 'Manquant au dépôt de 09:40',
      },
    ]);
  });
});
