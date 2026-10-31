import 'fake-indexeddb/auto';
import { OPERATING_PROFILE_KEY } from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { listWaitingParcels } from '#/features/handover/waiting';
import { loadPendingMails } from '#/features/mail/pending-mails';
import { loadParcelRecord } from '#/features/parcels/api/parcel-record';
import { listHomeParcels } from '#/features/parcels/api/use-parcels';
import { loadTour } from '#/features/parcels/api/use-tour';
import { planHandovers, planMails } from '#/features/parcels/selection';
import { describeRecord } from '#/features/parcels/record';
import { listSearchEntries } from '#/features/search/api/search-entries';
import { putOnTour } from '#/features/parcels/tour';
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

describe('« Mettre en route »', () => {
  const asShuttle = { agentId: 'agent-1', now: NOW };
  const toursOn = () =>
    db.setting.put({
      id: 'profile',
      key: OPERATING_PROFILE_KEY,
      value: { shuttleActsAsDepartment: false },
      updatedBy: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

  it('sends a parcel received before the tours towards its department, offline', async () => {
    await toursOn();
    await db.directoryPerson.put(
      personRow({ id: 'p-2', departmentId: 'finance', email: 'b@ysl.test' }),
    );
    await db.parcel.put(
      parcelRow({ id: 'before', status: 'recu', personId: 'p-2' }),
    );
    expect(await putOnTour(db, ['before'], asShuttle)).toEqual({
      onRoute: 1,
      toComplete: 0,
    });
    const row = await db.parcel.get('before');
    expect(row).toMatchObject({ status: 'en_route', departmentId: 'finance' });
    expect(
      await db.outbox
        .where('[entity+entityId]')
        .equals(['parcel', 'before'])
        .count(),
    ).toBe(1);
  });

  it('sends one with nowhere to go back to « À compléter », which asks', async () => {
    await toursOn();
    await db.parcel.put(
      parcelRow({
        id: 'nowhere',
        status: 'recu',
        contactId: null,
        personId: null,
      }),
    );
    expect(await putOnTour(db, ['nowhere'], asShuttle)).toEqual({
      onRoute: 0,
      toComplete: 1,
    });
    expect((await db.parcel.get('nowhere'))?.status).toBe('a_completer');
  });

  it('does nothing without tours, or to a parcel past « Reçu »', async () => {
    await db.parcel.put(
      parcelRow({ id: 'small', status: 'recu', personId: 'p-1' }),
    );
    expect(await putOnTour(db, ['small'], asShuttle)).toEqual({
      onRoute: 0,
      toComplete: 0,
    });
    await toursOn();
    expect(await putOnTour(db, [onTour.id], asShuttle)).toEqual({
      onRoute: 0,
      toComplete: 0,
    });
    expect((await db.parcel.get('small'))?.status).toBe('recu');
  });

  it('is what a parcel « Reçu » offers on its record, not a notice', async () => {
    await toursOn();
    await db.parcel.put(
      parcelRow({ id: 'cancelled', status: 'recu', personId: 'p-1' }),
    );
    const view = describeRecord((await loadParcelRecord(db, 'cancelled'))!, {
      now: NOW,
      t,
      showUnsent: false,
    });
    expect(view.action).toEqual({ kind: 'dispatch' });
  });
});

describe('a selection in a company that runs tours', () => {
  const received = parcelRow({ id: 'r', status: 'recu', personId: 'p-1' });
  const context = {
    people: new Map(),
    contacts: new Map(),
    tour: true,
  };

  it('notifies neither a parcel « Reçu » nor one on its way', () => {
    const { notice, reminder } = planMails([received, onTour], context);
    expect([...notice, ...reminder]).toEqual([]);
  });

  it('hands over what was deposited, not what the shuttle carries', () => {
    const put = parcelRow({ id: 'd', status: 'depose', personId: 'p-1' });
    const { groups } = planHandovers([received, put], true);
    expect(groups.flatMap(({ parcelIds }) => parcelIds)).toEqual(['d']);
    expect(
      planHandovers([received], false).groups.flatMap(
        ({ parcelIds }) => parcelIds,
      ),
    ).toEqual(['r']);
  });
});

describe('the tour read from the iPhone', () => {
  it('dates a parcel deposited from the day it left, not from its reception', async () => {
    const monday = new Date(NOW.getTime() - 5 * 86_400_000);
    const wednesday = new Date(NOW.getTime() - 3 * 86_400_000);
    await db.parcel.clear();
    await db.parcel.bulkPut([
      parcelRow({
        id: 'closed-earlier',
        status: 'depose',
        departmentId: 'finance',
        receivedAt: wednesday,
        depositedAt: new Date(wednesday.getTime() + 3_600_000),
        statusSeq: 1,
      }),
      parcelRow({
        id: 'sent-late',
        status: 'depose',
        departmentId: 'finance',
        receivedAt: monday,
        depositedAt: NOW,
        statusSeq: 2,
      }),
    ]);
    await db.event.put({
      id: 'left',
      entity: 'parcel',
      entityId: 'sent-late',
      type: 'parcel.status',
      detail: { from: 'recu', to: 'en_route' },
      agentId: 'agent-1',
      at: new Date(NOW.getTime() - 3_600_000),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    } as never);
    const { tour } = await loadTour(db, NOW);
    expect(tour.deposited).toBe(1);
  });
});
