import 'fake-indexeddb/auto';
import type { PullOutput } from '@repo/contract/sync';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import { SYNC_STATE_KEYS, type CourrierDatabase } from '#/features/db/schema';
import { createSyncEngine } from '#/features/sync/engine';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const empty: PullOutput = {
  generation: newId(),
  reset: false,
  rows: [],
  next: null,
  cursor: 10,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('createSyncEngine', () => {
  it('pushes then pulls, and records the time it all went through', async () => {
    await commitLocal(db, {
      upserts: [{ entity: 'parcel', row: parcelRow() }],
    });
    const push = vi.fn((input: { ops: { opId: string }[] }) =>
      Promise.resolve({
        results: input.ops.map((op) => ({
          opId: op.opId,
          status: 200 as const,
        })),
      }),
    );
    const pull = vi.fn().mockResolvedValue(empty);
    const engine = createSyncEngine({
      db,
      push,
      pull,
      online: () => true,
      now: () => NOW,
    });

    const run = await engine.syncNow();

    expect(run).toEqual({ status: 'idle', applied: 1, rejected: 0, pulled: 0 });
    expect(push.mock.invocationCallOrder[0]).toBeLessThan(
      pull.mock.invocationCallOrder[0]!,
    );
    expect(engine.getSnapshot()).toEqual({
      status: 'idle',
      lastSyncAt: NOW,
      lastError: null,
    });
    expect((await db.syncState.get(SYNC_STATE_KEYS.lastSyncAt))?.value).toEqual(
      NOW,
    );
  });

  it('runs one synchronisation at a time', async () => {
    const gate = deferred<PullOutput>();
    const pull = vi.fn(() => gate.promise);
    const engine = createSyncEngine({
      db,
      push: vi.fn().mockResolvedValue({ results: [] }),
      pull,
      online: () => true,
    });

    const first = engine.syncNow();
    const second = engine.syncNow();
    expect(engine.getSnapshot().status).toBe('syncing');
    gate.resolve(empty);

    expect(await Promise.all([first, second])).toEqual([
      { status: 'idle', applied: 0, rejected: 0, pulled: 0 },
      { status: 'idle', applied: 0, rejected: 0, pulled: 0 },
    ]);
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it('does not try while offline', async () => {
    const push = vi.fn();
    const engine = createSyncEngine({
      db,
      push,
      pull: vi.fn(),
      online: () => false,
    });

    const run = await engine.syncNow();

    expect(run.status).toBe('offline');
    expect(push).not.toHaveBeenCalled();
    expect(engine.getSnapshot().status).toBe('offline');
  });

  it('reports a failed request and tells when the session is gone', async () => {
    const onUnauthorized = vi.fn();
    const error = Object.assign(new Error('UNAUTHORIZED'), {
      data: { code: 'UNAUTHORIZED' },
    });
    const engine = createSyncEngine({
      db,
      push: vi.fn().mockResolvedValue({ results: [] }),
      pull: vi.fn().mockRejectedValue(error),
      online: () => true,
      onUnauthorized,
    });

    const run = await engine.syncNow();

    expect(run.status).toBe('error');
    expect(engine.getSnapshot()).toMatchObject({
      status: 'error',
      lastError: 'UNAUTHORIZED',
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
