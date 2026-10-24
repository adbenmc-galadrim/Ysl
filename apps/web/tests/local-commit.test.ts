import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { commitLocal, MissingRowError } from '#/features/db/commit';
import type { CourrierDatabase } from '#/features/db/schema';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('commitLocal', () => {
  it('writes the row and its outbox operation together', async () => {
    const row = parcelRow({ updatedAt: new Date(0) });
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
    const row = parcelRow();
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
    await expect(
      commitLocal(db, {
        upserts: [{ entity: 'parcel', row: parcelRow() }],
        deletes: [{ entity: 'parcel', id: 'missing' }],
      }),
    ).rejects.toBeInstanceOf(MissingRowError);

    expect(await db.parcel.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps the operations in the order they were made', async () => {
    const first = parcelRow();
    const second = parcelRow();
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
