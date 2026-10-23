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
  const committed: number[] = [];
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
    recordCommit: (seq) => void committed.push(seq),
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
      { count: committed.length, lastSeq: Math.max(0, ...committed) },
    );
  };
  return { db, files, logs, committed, writer, report };
}

describe('Writer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('writes parcel, outbox entry and photo with a continuous seq', async () => {
    const { db, files, committed, writer, report } = setup();

    await writer.writeOne();
    await writer.writeOne();

    expect((await db.parcels.toArray()).map((row) => row.seq)).toEqual([1, 2]);
    expect(await db.outbox.count()).toBe(2);
    expect(files.size).toBe(2);
    expect(committed).toEqual([1, 2]);
    expect((await report()).noLoss).toBe(true);
  });

  it('leaves an orphan photo but no parcel without photo when Dexie fails', async () => {
    const { db, files, logs, committed, writer, report } = setup();
    vi.spyOn(db, 'transaction').mockRejectedValue(new Error('boom'));

    const written = await writer.writeOne();

    expect(written).toBe(false);
    expect(logs).toContain('parcel-write-failed');
    expect(files.size).toBe(1);
    expect(await db.parcels.count()).toBe(0);
    expect(committed).toEqual([]);
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

  it('keeps the orphan of a failed attempt instead of overwriting it', async () => {
    const { db, files, writer } = setup();
    const spy = vi
      .spyOn(db, 'transaction')
      .mockRejectedValueOnce(new Error('boom'));

    await writer.writeOne();
    spy.mockRestore();
    await writer.writeOne();

    expect(files.size).toBe(2);
    expect(await db.parcels.count()).toBe(1);
  });
});
