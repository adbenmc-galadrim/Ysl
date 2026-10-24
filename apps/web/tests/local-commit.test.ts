import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import { commitLocal, MissingRowError } from '#/features/db/commit';
import { CourrierDatabase, type LocalParcel } from '#/features/db/schema';

const NOW = new Date('2026-10-24T08:12:00Z');

function parcel(overrides: Partial<LocalParcel> = {}): LocalParcel {
  return {
    id: newId(),
    createdAt: NOW,
    updatedAt: new Date(0),
    deletedAt: null,
    batchId: null,
    type: 'colis',
    status: 'recu',
    carrier: 'UPS',
    tracking: '1ZE6344W0499230622',
    trackingNorm: '1ZE6344W0499230622',
    personId: null,
    contactId: null,
    readName: null,
    notificationEmail: null,
    department: null,
    senderId: null,
    senderName: null,
    pieceN: null,
    pieceTotal: null,
    weightKg: null,
    carrierService: null,
    reference: null,
    location: null,
    notes: null,
    receivedAt: NOW,
    receivedBy: 'agent-1',
    validatedAt: null,
    notifiedAt: null,
    lastNotifiedAt: null,
    deliveredAt: null,
    deliveredBy: null,
    ...overrides,
  };
}

let db: CourrierDatabase;

beforeEach(async () => {
  db = new CourrierDatabase(`commit-test-${newId()}`);
  await db.open();
});

describe('commitLocal', () => {
  it('writes the row and its outbox operation together', async () => {
    const row = parcel();
    const [opId] = await commitLocal(
      db,
      { upserts: [{ entity: 'parcel', row }] },
      { now: NOW },
    );

    const stored = await db.parcel.get(row.id);
    expect(stored?.updatedAt).toEqual(NOW);
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      opId,
      entity: 'parcel',
      entityId: row.id,
      type: 'upsert',
      clientTs: NOW,
      attempts: 0,
      lastError: null,
    });
    expect(ops[0]?.patch).toMatchObject({ id: row.id, status: 'recu' });
  });

  it('deletes logically and queues the deletion', async () => {
    const row = parcel();
    await db.parcel.put(row);

    await commitLocal(
      db,
      { deletes: [{ entity: 'parcel', id: row.id }] },
      { now: NOW },
    );

    expect((await db.parcel.get(row.id))?.deletedAt).toEqual(NOW);
    const [op] = await db.outbox.toArray();
    expect(op).toMatchObject({
      type: 'delete',
      entityId: row.id,
      patch: { deletedAt: NOW },
    });
  });

  it('writes nothing when one change of the lot fails', async () => {
    const row = parcel();

    await expect(
      commitLocal(db, {
        upserts: [{ entity: 'parcel', row }],
        deletes: [{ entity: 'parcel', id: 'missing' }],
      }),
    ).rejects.toBeInstanceOf(MissingRowError);

    expect(await db.parcel.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps the operations in the order they were made', async () => {
    const first = parcel();
    const second = parcel();
    const ids = await commitLocal(db, {
      upserts: [
        { entity: 'parcel', row: first },
        { entity: 'parcel', row: second },
      ],
    });

    const ops = await db.outbox.orderBy('seq').toArray();
    expect(ops.map((op) => op.opId)).toEqual(ids);
    expect(ops.map((op) => op.entityId)).toEqual([first.id, second.id]);
  });
});
