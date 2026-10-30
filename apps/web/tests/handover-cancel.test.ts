import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { CANCEL_REASONS } from '@repo/ui';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  cancelHandover,
  canCancelHandover,
  describeCancelSheet,
  HandoverCancelRefusedError,
  reasonOfLabel,
} from '#/features/handover/cancel-handover';
import { commitLocal } from '#/features/db/commit';
import {
  cancelledHandoverOf,
  lostHandoverIds,
} from '#/features/handover/delivered';
import { loadHandoverEntry } from '#/features/handover/entry';
import { loadParcelRecord } from '#/features/parcels/api/parcel-record';
import { parcelEvent } from '#/features/parcels/events';
import { describeRecord } from '#/features/parcels/record';
import { recordHandover } from '#/features/handover/record-handover';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
  pickupCodeRow,
} from './helpers/local-rows';

const LATER = new Date(NOW.getTime() + 5 * 60 * 1000);
const LATER_STILL = new Date(NOW.getTime() + 7 * 60 * 1000);
const LATEST = new Date(NOW.getTime() + 10 * 60 * 1000);
const AGENT = { agentId: 'agent-1', agentName: 'Karim Benali' };

let db: CourrierDatabase;
let notified: LocalParcel;
let received: LocalParcel;
let handoverId: string;
let codeId: string;

beforeEach(async () => {
  db = await openTestDatabase();
  const nora = personRow({ firstName: 'Nora', lastName: 'Haddad' });
  notified = parcelRow({
    personId: nora.id,
    status: 'notifie',
    notifiedAt: NOW,
  });
  received = parcelRow({ personId: nora.id });
  const code = await pickupCodeRow({ personId: nora.id });
  codeId = code.id;
  await db.directoryPerson.put(nora);
  await db.parcel.bulkPut([notified, received]);
  await db.pickupCode.put(code);
  ({ handoverId } = await recordHandover(
    db,
    {
      kind: 'person',
      id: nora.id,
      via: 'pin',
      at: NOW.getTime(),
      code: code.id,
      parcelIds: [notified.id, received.id],
    },
    { ...AGENT, now: LATER },
  ));
  await db.outbox.clear();
});

const cancel = (now = LATEST) =>
  cancelHandover(
    db,
    handoverId,
    { reason: 'wrong_parcel', note: '  Celui de M. Bernard ' },
    { ...AGENT, now },
  );

const t = createTranslator(DEFAULT_LOCALE);

describe('the sheet', () => {
  it('says which handover it undoes, and how many parcels go back', async () => {
    const entry = (await loadHandoverEntry(db, handoverId))!;

    const sheet = describeCancelSheet(entry, LATEST, t);

    expect(sheet.proof).toBe('À Nora Haddad, Code vérifié, par Karim Benali');
    expect(sheet.backTitle).toBe('Les 2 colis repassent en attente de retrait');
    expect(
      describeCancelSheet({ ...entry, parcels: [notified] }, LATEST, t)
        .backTitle,
    ).toBe('Le colis repasse en attente de retrait');
  });

  it('maps each chip of the design system to its reason', () => {
    expect(CANCEL_REASONS.map((label) => reasonOfLabel(label, t))).toEqual([
      'wrong_parcel',
      'wrong_person',
      'entry_error',
    ]);
  });
});

describe('canCancelHandover', () => {
  it('holds back a handover the server refused or left without parcels', async () => {
    const entry = (await loadHandoverEntry(db, handoverId))!;

    expect(canCancelHandover(entry)).toBe(true);
    expect(canCancelHandover({ ...entry, sync: 'rejected' })).toBe(false);
    expect(canCancelHandover({ ...entry, parcels: [] })).toBe(false);
  });
});

describe('cancelHandover', () => {
  it('sends each parcel back to where it waited, and keeps the trace', async () => {
    await expect(cancel()).resolves.toEqual({ count: 2 });

    expect(await db.parcel.get(notified.id)).toMatchObject({
      status: 'notifie',
      deliveredAt: null,
      deliveredBy: null,
      notifiedAt: NOW,
    });
    expect((await db.parcel.get(received.id))?.status).toBe('recu');
    expect(await db.handover.get(handoverId)).toMatchObject({
      cancelledAt: LATEST,
      cancelReason: 'wrong_parcel',
      cancelNote: 'Celui de M. Bernard',
      cancelledByName: 'Karim Benali',
    });
    const events = await db.event
      .filter((row) => row.type === 'parcel.handover_cancelled')
      .toArray();
    expect(events.map((row) => row.entityId).sort()).toEqual(
      [notified.id, received.id].sort(),
    );
    expect(readParcelEvent(events[0]!.type, events[0]!.detail)).toMatchObject({
      handoverId,
      reason: 'wrong_parcel',
      note: 'Celui de M. Bernard',
    });
  });

  it('queues the handover before the parcels the server guards', async () => {
    await cancel();

    const ops = await db.outbox.orderBy('seq').toArray();
    expect(ops.slice(0, 3).map((op) => op.entity)).toEqual([
      'handover',
      'parcel',
      'parcel',
    ]);
  });

  it('never dates a cancellation before its handover', async () => {
    await cancel(NOW);

    expect((await db.handover.get(handoverId))?.cancelledAt).toEqual(LATER);
  });

  it('leaves a parcel another handover won', async () => {
    await db.parcel.update(received.id, {
      deliveredAt: LATEST,
      deliveredBy: 'agent-2',
    });

    await expect(cancel()).resolves.toEqual({ count: 1 });

    expect((await db.parcel.get(received.id))?.status).toBe('remis');
  });

  it('keeps the used code closed', async () => {
    const used = (await db.pickupCode.get(codeId))?.usedAt;
    await cancel();

    expect(used).toEqual(LATER);
    expect((await db.pickupCode.get(codeId))?.usedAt).toEqual(LATER);
  });

  it('refuses a handover already cancelled or gone', async () => {
    await cancel();
    await expect(cancel()).rejects.toBeInstanceOf(HandoverCancelRefusedError);

    await expect(
      cancelHandover(db, 'absent', { reason: 'entry_error' }, AGENT),
    ).rejects.toBeInstanceOf(HandoverCancelRefusedError);
  });

  it('tells the reason on the record and in the history', async () => {
    await cancel();

    const record = (await loadParcelRecord(db, received.id))!;
    const view = describeRecord(record, { now: LATEST, t, showUnsent: true });

    expect(view.handover?.items).toEqual(
      expect.arrayContaining([
        { label: 'Motif', value: 'Mauvais colis' },
        { label: 'Précision', value: 'Celui de M. Bernard' },
        { label: 'Annulée par', value: 'Karim Benali' },
      ]),
    );
    expect(view.history?.map((entry) => entry.title)).toEqual(
      expect.arrayContaining([
        'Remise annulée : mauvais colis (Celui de M. Bernard)',
      ]),
    );
  });

  it('keeps the story of a handover undone, masks the one that lost', async () => {
    const loser = {
      ...(await db.handover.get(handoverId))!,
      id: 'lost-one',
      at: LATER_STILL,
    };
    await db.handover.add(loser);
    await cancel();
    const back = (await db.parcel.get(received.id))!;

    const whileWaiting = await lostHandoverIds(db, back);
    const handedAgain = await lostHandoverIds(db, {
      ...back,
      status: 'remis',
      deliveredAt: new Date(LATEST.getTime() + 1000),
      deliveredBy: 'agent-1',
    });

    expect(whileWaiting.has(handoverId)).toBe(false);
    expect(whileWaiting.has('lost-one')).toBe(true);
    expect(handedAgain.has(handoverId)).toBe(false);
    expect(handedAgain.has('lost-one')).toBe(true);
  });

  it('masks a handover undone for its other parcels on the parcel it lost', async () => {
    await db.parcel.update(received.id, {
      deliveredAt: LATEST,
      deliveredBy: 'agent-2',
    });
    await cancel();

    const stillRemis = (await db.parcel.get(received.id))!;

    expect((await lostHandoverIds(db, stillRemis)).has(handoverId)).toBe(true);
  });

  it('tells the handover undone, not a later one that lost the parcel', async () => {
    await db.handover.add({
      ...(await db.handover.get(handoverId))!,
      id: 'lost-one',
      at: LATER_STILL,
      cancelledAt: LATER_STILL,
    });
    await cancel();
    const back = (await db.parcel.get(received.id))!;

    expect((await cancelledHandoverOf(db, back))?.id).toBe(handoverId);
  });

  it('tells one cancellation, with the reason kept, when two iPhones undid it', async () => {
    await cancel();
    await commitLocal(db, {
      upserts: [
        parcelEvent(
          received.id,
          {
            type: 'parcel.handover_cancelled',
            handoverId,
            reason: 'entry_error',
            note: null,
          },
          { agentId: 'agent-2', now: LATEST },
        ),
      ],
    });

    const record = (await loadParcelRecord(db, received.id))!;
    const titles = describeRecord(record, {
      now: LATEST,
      t,
      showUnsent: true,
    }).history?.map((entry) => entry.title);

    expect(
      titles?.filter(
        (title) =>
          typeof title === 'string' && title.startsWith('Remise annulée'),
      ),
    ).toEqual(['Remise annulée : mauvais colis (Celui de M. Bernard)']);
  });
});
