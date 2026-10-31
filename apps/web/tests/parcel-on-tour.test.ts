import 'fake-indexeddb/auto';
import { OPERATING_PROFILE_KEY } from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { listWaitingParcels } from '#/features/handover/waiting';
import { loadPendingMails } from '#/features/mail/pending-mails';
import { loadParcelRecord } from '#/features/parcels/api/parcel-record';
import { listHomeParcels } from '#/features/parcels/api/use-parcels';
import { describeRecord } from '#/features/parcels/record';
import { listSearchEntries } from '#/features/search/api/search-entries';
import { groupResults } from '#/features/search/search-index';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

let db: CourrierDatabase;

const onTour = parcelRow({
  id: 'on-tour',
  status: 'en_route',
  personId: 'p-1',
  departmentId: 'finance',
  receivedAt: NOW,
});

beforeEach(async () => {
  db = await openTestDatabase();
  await db.department.put({
    id: 'finance',
    name: 'Finance',
    receptionPoint: null,
    replyEmail: null,
    pickup: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  });
  await db.directoryPerson.put(
    personRow({ id: 'p-1', department: 'Presse', email: 'p@ysl.test' }),
  );
  await db.parcel.put(onTour);
});

describe('a parcel on tour', () => {
  it('stays on the home list, naming where it goes', async () => {
    const [row] = await listHomeParcels(db, NOW);
    expect(row).toMatchObject({ state: 'onTour', department: 'Finance' });
  });

  it('is found by the search', async () => {
    const entries = await listSearchEntries(db, NOW);
    expect(entries.map((entry) => entry.row.state)).toEqual(['onTour']);
    const sections = groupResults(entries, 'status', NOW, t);
    expect(
      sections.map(({ title, parcels }) => [title, parcels.length]),
    ).toEqual([['En route', 1]]);
  });

  it('waits for no mail and no handover yet', async () => {
    expect(await loadPendingMails(db)).toEqual([]);
    expect(await listWaitingParcels(db, { kind: 'person', id: 'p-1' })).toEqual(
      [],
    );
  });

  it('has its tour undone until an e-mail left', async () => {
    const view = async () =>
      describeRecord((await loadParcelRecord(db, onTour.id))!, {
        now: NOW,
        t,
        showUnsent: false,
      });
    expect((await view()).place).toBe('Finance');
    expect((await view()).action).toEqual({
      kind: 'stepBack',
      from: 'en_route',
      to: 'recu',
    });
    await db.parcel.update(onTour.id, { lastNotifiedAt: NOW });
    expect((await view()).action).toBeUndefined();
  });
});

describe('handing over with tours', () => {
  const profile = (value: unknown) =>
    db.setting.put({
      id: 'profile',
      key: OPERATING_PROFILE_KEY,
      value,
      updatedBy: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });
  const waiting = async () =>
    (await listWaitingParcels(db, { kind: 'person', id: 'p-1' })).map(
      ({ id }) => id,
    );

  beforeEach(async () => {
    await db.parcel.bulkPut([
      parcelRow({ id: 'at-desk', status: 'recu', personId: 'p-1' }),
      parcelRow({ id: 'put-down', status: 'depose', personId: 'p-1' }),
    ]);
  });

  it('offers what was deposited, not what the shuttle still carries', async () => {
    await profile({ shuttleActsAsDepartment: false });
    expect(await waiting()).toEqual(['put-down']);
  });

  it('leaves a parcel « Reçu » at the desk of a small site', async () => {
    await profile({ shuttleActsAsDepartment: true });
    expect(await waiting()).toEqual(expect.arrayContaining(['at-desk']));
  });
});
