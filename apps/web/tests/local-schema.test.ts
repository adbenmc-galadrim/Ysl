import 'fake-indexeddb/auto';
import { SYNCED_ENTITIES } from '@repo/db/schema';
import { describe, expect, it } from 'vitest';
import { CourrierDatabase } from '#/features/db/schema';

describe('CourrierDatabase', () => {
  it('mirrors every synced entity of the server, plus the local tables', async () => {
    const db = new CourrierDatabase('schema-test');
    await db.open();
    const names = db.tables.map((table) => table.name).sort();
    expect(names).toEqual(
      [...SYNCED_ENTITIES, 'outbox', 'photo', 'sync_state'].sort(),
    );
    expect(db.verno).toBe(1);
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
});
