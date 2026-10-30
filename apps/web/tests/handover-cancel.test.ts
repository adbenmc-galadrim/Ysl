import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  cancelHandover,
  canCancelHandover,
  HandoverCancelRefusedError,
} from '#/features/handover/cancel-handover';
import { lostHandoverIds } from '#/features/handover/delivered';
import { loadHandoverEntry } from '#/features/handover/entry';
import { recordHandover } from '#/features/handover/record-handover';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
  pickupCodeRow,
} from './helpers/local-rows';

const LATER = new Date(NOW.getTime() + 5 * 60 * 1000);
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

  it('keeps the story of a handover undone, not of one that lost', async () => {
    await cancel();
    const parcel = (await db.parcel.get(received.id))!;
    const handedAgain = {
      ...parcel,
      status: 'remis' as const,
      deliveredAt: new Date(LATEST.getTime() + 1000),
      deliveredBy: 'agent-1',
    };
    await db.handover.add({
      ...(await db.handover.get(handoverId))!,
      id: 'lost-one',
      cancelReason: null,
    });

    const lost = await lostHandoverIds(db, handedAgain);

    expect(lost.has(handoverId)).toBe(false);
    expect(lost.has('lost-one')).toBe(true);
  });
});
