import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { Parcel, ParcelState } from '@repo/ui';
import { describe, expect, it } from 'vitest';
import type {
  LocalDeposit,
  LocalHandover,
  LocalParcel,
} from '#/features/db/schema';
import {
  arrivedWithin,
  depositNotice,
  historyLine,
  inTab,
  provenBy,
  spaceCounts,
  type SpaceParcel,
  tabOf,
  takenBy,
  withinPeriod,
} from '#/features/department-space/space';
import { isWaiting } from '#/features/handover/waiting';
import { loadSpace } from '#/features/department-space/load';
import {
  summarizeDepartment,
  toDepartmentSections,
} from '#/features/parcels/sections';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const now = new Date('2026-11-02T12:00:00');

const row = (
  state: ParcelState,
  status = 'notifie',
  handover?: Partial<LocalHandover>,
): SpaceParcel => ({
  tab: tabOf(status, false),
  parcel: {
    status,
    receivedAt: now,
    updatedAt: now,
  } as unknown as LocalParcel,
  entry: { row: { state } } as SpaceParcel['entry'],
  handover: handover as LocalHandover | undefined,
});

const deposit = (over: Partial<LocalDeposit>): LocalDeposit =>
  ({
    id: 'd1',
    announced: 6,
    shuttleName: 'Karim',
    postedAt: new Date('2026-11-02T10:56:00'),
    confirmedAt: null,
    deletedAt: null,
    ...over,
  }) as LocalDeposit;

describe('the tabs of the department', () => {
  it.each([
    ['en_route', false, 'coming'],
    ['recu', true, 'coming'],
    ['a_completer', true, 'coming'],
    ['recu', false, 'present'],
    ['depose', false, 'present'],
    ['notifie', false, 'present'],
    ['a_regulariser', false, 'history'],
    ['remis', false, 'history'],
    ['retourne', false, 'history'],
  ] as const)('puts %s (tour: %s) under %s', (status, tour, tab) => {
    expect(tabOf(status, tour)).toBe(tab);
  });

  it('keeps a parcel on its way to come even with its e-mail due', () => {
    expect(inTab([row('toNotify', 'en_route')], 'coming')).toHaveLength(1);
  });

  it('counts each parcel in its tab only', () => {
    expect(
      spaceCounts([
        row('onTour', 'en_route'),
        row('late'),
        row('notified'),
        row('returned', 'retourne'),
      ]),
    ).toEqual({ coming: 1, present: 2, history: 1 });
  });
});

describe('the filters', () => {
  it('keeps the last seven days as this week', () => {
    expect(arrivedWithin(new Date('2026-10-27T08:00:00'), 'week', now)).toBe(true);
    expect(arrivedWithin(new Date('2026-10-26T23:00:00'), 'week', now)).toBe(false);
  });

  it('stops today at midnight', () => {
    expect(arrivedWithin(new Date('2026-11-01T23:59:00'), 'today', now)).toBe(false);
  });

  it('keeps thirty days of history unless asked for everything', () => {
    const old = new Date('2026-09-01T10:00:00');
    expect(withinPeriod(old, 'last30', now)).toBe(false);
    expect(withinPeriod(old, 'all', now)).toBe(true);
  });

  it('finds a proof only on a handover that has it', () => {
    expect(provenBy(row('handedOver', 'remis', { method: 'qr' }), 'pin')).toBe(false);
    expect(provenBy(row('returned', 'retourne'), 'qr')).toBe(false);
    expect(provenBy(row('returned', 'retourne'), 'all')).toBe(true);
  });
});

describe('the history', () => {
  it('names the colleague who collected', () => {
    const delegated = row('handedOver', 'remis', {
      recipientName: 'Romain Garnier',
      delegateName: 'Lucie Hamel',
      method: 'signature',
    });
    expect(takenBy(delegated, t)).toBe('Lucie Hamel (collègue)');
    expect(historyLine(delegated, t)).toContain('Lucie Hamel');
  });

  it('gives a returned parcel to the carrier, a parcel held back to nobody', () => {
    expect(takenBy(row('returned', 'retourne'), t)).toBe('Transporteur');
    expect(takenBy(row('toSettle', 'a_regulariser'), t)).toBe('—');
    expect(historyLine(row('toSettle', 'a_regulariser'), t)).toBe('À régulariser');
  });
});

describe('the deposit to count', () => {
  it('says nothing once confirmed', () => {
    expect(depositNotice([deposit({ confirmedAt: now })], t)).toBeUndefined();
  });

  it('opens the only one waiting', () => {
    const notice = depositNotice([deposit({})], t);
    expect(notice?.depositId).toBe('d1');
    expect(notice?.title).toContain('Karim');
    expect(notice?.title).toContain('6');
  });

  it('opens the list when several wait', () => {
    const notice = depositNotice([deposit({}), deposit({ id: 'd2' })], t);
    expect(notice?.depositId).toBeUndefined();
    expect(notice?.title).toContain('2');
  });
});

describe('the record of a department', () => {
  it.each([
    ['recu', false, true],
    ['recu', true, false],
    ['notifie', true, true],
    ['depose', true, true],
    ['en_route', true, false],
    ['a_regulariser', true, false],
    ['remis', true, false],
    ['retourne', true, false],
  ])('offers to hand over a parcel %s (tour: %s): %s', (status, tour, offered) => {
    expect(isWaiting({ status } as LocalParcel, tour)).toBe(offered);
  });
});

describe('loadSpace', () => {
  it('leaves out a deleted parcel, and files the others by status', async () => {
    const db = await openTestDatabase();
    const kept = parcelRow({ status: 'notifie', notifiedAt: NOW });
    await db.parcel.bulkPut([
      kept,
      parcelRow({ status: 'notifie', notifiedAt: NOW, deletedAt: NOW }),
    ]);
    const rows = await loadSpace(db, NOW);
    expect(rows.map((row) => [row.parcel.id, row.tab])).toEqual([
      [kept.id, 'present'],
    ]);
  });
});

describe('the phone of a department', () => {
  const parcels = (['notified', 'late', 'onTour', 'handedOver', 'toSettle'] as const).map(
    (state, index) => ({ id: String(index), state }) as Parcel,
  );

  it('lists what is here before what is coming, not what left', () => {
    const titles = toDepartmentSections(parcels).map((section) => section.title);
    expect(titles).toEqual(['Présents', 'À régulariser', 'À venir']);
  });

  it('keeps the parcels to notify apart: their mail still leaves from here', () => {
    const [first] = toDepartmentSections([{ id: 'a', state: 'toNotify' } as Parcel]);
    expect(first?.title).toBe('À notifier');
  });

  it('keeps a parcel to complete out of the present, a tour may still bring it', () => {
    const titles = toDepartmentSections([
      { id: 'a', state: 'incomplete' } as Parcel,
    ]).map((section) => section.title);
    expect(titles).toEqual(['À compléter']);
  });

  it('says one present in the singular', () => {
    expect(summarizeDepartment({ present: 1, coming: 0 }, 'Studio')).toBe(
      'Studio · 1 présent, 0 à venir',
    );
  });

  it('sums up the name and the two counts', () => {
    expect(summarizeDepartment({ present: 2, coming: 1 }, 'Studio')).toBe(
      'Studio · 2 présents, 1 à venir',
    );
  });
});
