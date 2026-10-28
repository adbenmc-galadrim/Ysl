import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { clearLocalData } from '#/features/db/clear';
import { commitLocal } from '#/features/db/commit';
import { addHandoverProof } from '#/features/handover/proofs';
import { MemoryFiles } from './helpers/memory-files';
import {
  handoverRow,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

describe('clearLocalData', () => {
  it('empties every table and removes the photo files, signatures included', async () => {
    const db = await openTestDatabase();
    const files = new MemoryFiles();
    await commitLocal(db, {
      upserts: [
        { entity: 'parcel', row: parcelRow() },
        { entity: 'directory_person', row: personRow() },
      ],
    });
    await db.syncState.put({ key: 'cursor', value: { xid: 10 } });
    await db.draftBatch.put({ id: 'b1', startedAt: new Date() });
    await files.save('p1.jpg', new Blob(['x']));
    const handover = handoverRow();
    await db.handover.put(handover);
    await addHandoverProof(db, files, handover.id, {
      kind: 'signature',
      blob: new Blob(['png']),
      width: 10,
      height: 10,
    });

    await clearLocalData(db, files);

    for (const table of db.tables) {
      expect(await table.count(), table.name).toBe(0);
    }
    expect(await files.list()).toEqual([]);
  });

  it('clears the tables when the device has no photo storage', async () => {
    const db = await openTestDatabase();
    await db.parcel.put(parcelRow());

    await clearLocalData(db, null);

    expect(await db.parcel.count()).toBe(0);
  });
});
