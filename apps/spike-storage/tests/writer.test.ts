import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpikeDatabase } from '#/storage/db';
import { checkIntegrity, type FileInfo } from '#/storage/integrity';
import { Writer } from '#/storage/writer';

let counter = 0;

function setup() {
  const db = new SpikeDatabase(`writer-test-${counter++}`);
  const files = new Map<string, Blob>();
  const logs: string[] = [];
  const writer = new Writer({
    db,
    savePhoto: (name, blob) => {
      files.set(name, blob);
      return Promise.resolve();
    },
    makePhoto: (seq) =>
      Promise.resolve({
        blob: new Blob([`photo ${seq}`]),
        sha256: `sha-${seq}`,
      }),
    log: (name) => void logs.push(name),
    sessionId: 'session',
  });
  const report = async () => {
    const stored: FileInfo[] = [...files].map(([name, blob]) => ({
      name,
      size: blob.size,
    }));
    return checkIntegrity(
      await db.parcels.toArray(),
      await db.outbox.toArray(),
      stored,
    );
  };
  return { db, files, logs, writer, report };
}

describe('Writer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('writes parcel, outbox entry and photo with a continuous seq', async () => {
    const { db, files, writer, report } = setup();

    await writer.writeOne();
    await writer.writeOne();

    expect((await db.parcels.toArray()).map((row) => row.seq)).toEqual([1, 2]);
    expect(await db.outbox.count()).toBe(2);
    expect(files.size).toBe(2);
    expect((await report()).noLoss).toBe(true);
  });

  it('leaves an orphan photo but no parcel without photo when Dexie fails', async () => {
    const { db, files, logs, writer, report } = setup();
    vi.spyOn(db, 'transaction').mockRejectedValue(new Error('boom'));

    const written = await writer.writeOne();

    expect(written).toBe(false);
    expect(logs).toContain('parcel-write-failed');
    expect(files.size).toBe(1);
    expect(await db.parcels.count()).toBe(0);
    const result = await report();
    expect(result.orphanPhotos).toHaveLength(1);
    expect(result.parcelsWithoutPhoto).toEqual([]);
    expect(result.noLoss).toBe(true);
  });

  it('creates neither parcel nor outbox entry when the outbox add fails', async () => {
    const { db, writer } = setup();
    vi.spyOn(db.outbox, 'add').mockRejectedValue(new Error('boom'));

    const written = await writer.writeOne();

    expect(written).toBe(false);
    expect(await db.parcels.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});
