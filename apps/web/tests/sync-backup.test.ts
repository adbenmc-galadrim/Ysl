import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import {
  backupFile,
  backupFileName,
  buildBackup,
} from '#/features/sync/backup';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

describe('buildBackup', () => {
  it('carries every waiting operation with its patch and its local row, no photo', async () => {
    const db = await openTestDatabase();
    const kept = parcelRow();
    const removed = parcelRow();
    const [, refused, deletion] = await commitLocal(
      db,
      {
        upserts: [
          { entity: 'parcel', row: kept },
          { entity: 'parcel', row: removed },
        ],
        deletes: [{ entity: 'parcel', id: removed.id }],
      },
      { now: NOW },
    );
    await db.outbox
      .where('opId')
      .anyOf([refused!, deletion!])
      .modify((op) => {
        op.state = 'rejected';
        op.lastError = 'doublon';
      });
    await db.photo.add({
      id: 'photo-1',
      parcelId: kept.id,
      kind: 'etiquette',
      path: 'photos/photo-1.jpg',
      sha256: 'abc',
      width: 1600,
      height: 1200,
      bytes: 300_000,
      createdAt: NOW,
    });

    const backup = await buildBackup(db, { now: NOW, app: '2.0.3' });
    expect(backup).toMatchObject({
      format: 'courrier-secours',
      version: 1,
      exportedAt: NOW,
      app: '2.0.3',
      pending: 1,
      rejected: 2,
    });
    expect(backup.changes).toHaveLength(3);
    expect(backup.changes[0]).toMatchObject({
      entity: 'parcel',
      entityId: kept.id,
      type: 'upsert',
      state: 'queued',
      patch: { id: kept.id, tracking: kept.tracking },
      row: { id: kept.id, deletedAt: null },
    });
    expect(backup.changes[1]).toMatchObject({
      type: 'upsert',
      state: 'rejected',
      patch: { id: removed.id, tracking: removed.tracking },
    });
    expect(backup.changes[2]).toMatchObject({
      type: 'delete',
      state: 'rejected',
      lastError: 'doublon',
      row: { id: removed.id },
    });
    expect((backup.changes[2]!.row as { deletedAt: Date }).deletedAt).toEqual(
      NOW,
    );
    expect(backup.changes.some((change) => 'seq' in change)).toBe(false);

    const text = JSON.stringify(backup);
    expect(text).not.toContain('photo-1');
    expect(text).not.toContain('photos/');
    const parsed = JSON.parse(text) as { changes: { clientTs: string }[] };
    expect(parsed.changes[0]!.clientTs).toBe(NOW.toISOString());
  });

  it('is empty, not absent, when everything is sent', async () => {
    const db = await openTestDatabase();
    expect(await buildBackup(db, { now: NOW, app: '2.0.3' })).toMatchObject({
      pending: 0,
      rejected: 0,
      changes: [],
    });
  });
});

describe('backupFileName', () => {
  it('stamps the local date and time with two digits each', () => {
    expect(backupFileName(new Date(2026, 0, 5, 9, 7))).toBe(
      'courrier-secours-2026-01-05-0907.json',
    );
    expect(backupFileName(NOW)).toBe('courrier-secours-2026-10-24-1200.json');
  });

  it('wraps the JSON in a file the share sheet can take', async () => {
    const db = await openTestDatabase();
    const file = backupFile(
      await buildBackup(db, { now: NOW, app: '2.0.3' }),
      NOW,
    );
    expect(file.name).toBe('courrier-secours-2026-10-24-1200.json');
    expect(file.type).toBe('application/json');
    expect(JSON.parse(await file.text())).toMatchObject({
      format: 'courrier-secours',
    });
  });
});
