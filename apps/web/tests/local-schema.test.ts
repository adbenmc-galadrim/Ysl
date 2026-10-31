import 'fake-indexeddb/auto';
import { SYNCED_ENTITIES } from '@repo/db/schema';
import { Dexie } from 'dexie';
import { describe, expect, it } from 'vitest';
import { CourrierDatabase, SYNC_STATE_KEYS } from '#/features/db/schema';

describe('CourrierDatabase', () => {
  it('mirrors every synced entity of the server, plus the local tables', async () => {
    const db = new CourrierDatabase('schema-test');
    await db.open();
    const names = db.tables.map((table) => table.name).sort();
    expect(names).toEqual(
      [
        ...SYNCED_ENTITIES,
        'outbox',
        'photo',
        'sync_state',
        'draft_batch',
        'draft_parcel',
        'extraction',
        'handover_proof',
      ].sort(),
    );
    expect(db.verno).toBe(9);
    for (const entity of SYNCED_ENTITIES) {
      expect(db.synced(entity).schema.primKey.name).toBe('id');
    }
    db.close();
  });

  it('serves the home list from the status and reception index', async () => {
    const db = new CourrierDatabase('schema-index-test');
    await db.open();
    const names = db.parcel.schema.indexes.map((index) => index.name);
    expect(names).toContain('[status+receivedAt]');
    expect(names).toContain('trackingNorm');
    db.close();
  });

  it('finds the drafts of a batch, and a tracking already in it', async () => {
    const db = new CourrierDatabase('schema-draft-test');
    await db.open();
    const names = db.draftParcel.schema.indexes.map((index) => index.name);
    expect(names).toContain('batchId');
    expect(names).toContain('trackingNorm');
    db.close();
  });
});

describe('CourrierDatabase upgrade to version 3', () => {
  it('queues the operations an older outbox holds', async () => {
    const name = 'schema-upgrade-test';
    const older = new Dexie(name);
    older.version(1).stores({
      parcel: 'id',
      outbox: '++seq, &opId, [entity+entityId], clientTs',
      photo: 'id',
      sync_state: 'key',
    });
    older.version(2).stores({ draft_batch: 'id', draft_parcel: 'id' });
    await older.open();
    await older.table('outbox').add({
      opId: 'op-1',
      entity: 'parcel',
      entityId: 'p-1',
      type: 'upsert',
      patch: {},
      clientTs: new Date(),
      attempts: 0,
      lastError: null,
    });
    older.close();

    const db = new CourrierDatabase(name);
    await db.open();
    const [op] = await db.outbox.toArray();

    expect(db.verno).toBe(9);
    expect(op?.state).toBe('queued');
    expect(await db.outbox.where('state').equals('queued').count()).toBe(1);
    db.close();
  });
});

describe('CourrierDatabase upgrade to version 8', () => {
  it('reads everything again, for the departments the server held back', async () => {
    const name = 'schema-upgrade-8-test';
    const older = new Dexie(name);
    older.version(7).stores({ parcel: 'id', sync_state: 'key' });
    await older.open();
    await older.table('sync_state').bulkPut([
      { key: SYNC_STATE_KEYS.cursor, value: { generation: 'g', xid: 42 } },
      { key: SYNC_STATE_KEYS.lastSyncAt, value: new Date() },
    ]);
    await older.table('parcel').put({ id: 'p-1' });
    older.close();

    const db = new CourrierDatabase(name);
    await db.open();

    expect(await db.syncState.get(SYNC_STATE_KEYS.cursor)).toBeUndefined();
    expect(await db.syncState.get(SYNC_STATE_KEYS.lastSyncAt)).toBeDefined();
    expect(await db.parcel.get('p-1')).toBeDefined();
    db.close();
  });
});

describe('CourrierDatabase upgrade to version 9', () => {
  it('reads everything again, for the parcels of a tour shown as removed', async () => {
    const name = 'schema-upgrade-9-test';
    const older = new Dexie(name);
    older.version(8).stores({ parcel: 'id', sync_state: 'key' });
    await older.open();
    await older.table('sync_state').put({
      key: SYNC_STATE_KEYS.cursor,
      value: { generation: 'g', xid: 42 },
    });
    older.close();

    const db = new CourrierDatabase(name);
    await db.open();

    expect(await db.syncState.get(SYNC_STATE_KEYS.cursor)).toBeUndefined();
    db.close();
  });
});
