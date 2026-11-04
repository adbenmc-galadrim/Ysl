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
        'scan_report_outbox',
      ].sort(),
    );
    expect(db.verno).toBe(13);
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

    expect(db.verno).toBe(13);
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

describe('CourrierDatabase upgrade to version 12', () => {
  it('forgets the department word of parcels and people, and of their queued writes', async () => {
    const name = 'schema-upgrade-12-test';
    const older = new Dexie(name);
    older.version(11).stores({
      parcel: 'id',
      directory_person: 'id',
      contact: 'id',
      outbox: '++seq, &opId, [entity+entityId], clientTs, state',
    });
    await older.open();
    await older.table('parcel').put({
      id: 'p-1',
      departmentId: 'd-1',
      department: 'Studio',
      tracking: 'T1',
    });
    await older.table('directory_person').put({
      id: 'a-1',
      departmentId: 'd-1',
      department: 'Studio',
      lastName: 'Morel',
    });
    await older.table('contact').put({ id: 'c-1', department: 'Intérim' });
    const op = (opId: string, entity: string, entityId: string) => ({
      opId,
      entity,
      entityId,
      type: 'upsert',
      patch: { id: entityId, department: 'Studio', departmentId: 'd-1' },
      clientTs: new Date(),
      state: 'queued',
      attempts: 0,
      lastError: null,
    });
    await older
      .table('outbox')
      .bulkAdd([
        op('op-1', 'parcel', 'p-1'),
        op('op-2', 'directory_person', 'a-1'),
        op('op-3', 'contact', 'c-1'),
      ]);
    older.close();

    const db = new CourrierDatabase(name);
    await db.open();

    expect(db.verno).toBe(13);
    expect(await db.parcel.get('p-1')).toEqual({
      id: 'p-1',
      departmentId: 'd-1',
      tracking: 'T1',
    });
    expect(await db.directoryPerson.get('a-1')).toEqual({
      id: 'a-1',
      departmentId: 'd-1',
      lastName: 'Morel',
    });
    expect(await db.contact.get('c-1')).toEqual({
      id: 'c-1',
      department: 'Intérim',
    });
    const ops = await db.outbox.orderBy('seq').toArray();
    expect(ops.map((row) => row.patch)).toEqual([
      { id: 'p-1', departmentId: 'd-1' },
      { id: 'a-1', departmentId: 'd-1' },
      { id: 'c-1', department: 'Studio', departmentId: 'd-1' },
    ]);
    expect(ops.map((row) => row.state)).toEqual(['queued', 'queued', 'queued']);
    db.close();
  });
});
