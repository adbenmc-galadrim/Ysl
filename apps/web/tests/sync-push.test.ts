import 'fake-indexeddb/auto';
import type { PushInput, PushOutput } from '@repo/contract/sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase } from '#/features/db/schema';
import { pushOutbox } from '#/features/sync/push';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

async function queue(count: number): Promise<string[]> {
  return commitLocal(
    db,
    {
      upserts: Array.from({ length: count }, () => ({
        entity: 'parcel' as const,
        row: parcelRow(),
      })),
    },
    { now: NOW },
  );
}

const answering =
  (statuses: PushOutput['results'][number]['status'][]) =>
  (input: PushInput): Promise<PushOutput> =>
    Promise.resolve({
      results: input.ops.flatMap((op, index) => {
        const status = statuses[index];
        return status === undefined
          ? []
          : [{ opId: op.opId, status, message: `HTTP ${status}` }];
      }),
    });

describe('pushOutbox', () => {
  it('sends the queued operations in order and drops the applied ones', async () => {
    const ids = await queue(3);
    const client = vi.fn(answering([200, 200, 200]));

    const outcome = await pushOutbox(db, client);

    expect(outcome).toEqual({ stopped: 'done', applied: 3, rejected: 0 });
    expect(client).toHaveBeenCalledTimes(1);
    expect(client.mock.calls[0]?.[0].ops.map((op) => op.opId)).toEqual(ids);
    expect(client.mock.calls[0]?.[0].ops[0]).toMatchObject({
      entity: 'parcel',
      type: 'upsert',
      clientTs: NOW,
    });
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps a refused operation as rejected, with the reason', async () => {
    const [kept, refused] = await queue(2);
    const outcome = await pushOutbox(db, answering([200, 409]));

    expect(outcome).toEqual({ stopped: 'done', applied: 1, rejected: 1 });
    expect(await db.outbox.where('opId').equals(kept!).count()).toBe(0);
    expect(
      await db.outbox.where('opId').equals(refused!).first(),
    ).toMatchObject({
      state: 'rejected',
      lastError: 'HTTP 409',
    });
    expect(await db.outbox.where('state').equals('queued').count()).toBe(0);
  });

  it('stops at a retry and leaves the rest untouched', async () => {
    const [first, second, third] = await queue(3);
    const client = vi.fn(answering([200, 503]));

    const outcome = await pushOutbox(db, client);

    expect(outcome).toEqual({ stopped: 'retry', applied: 1, rejected: 0 });
    expect(client).toHaveBeenCalledTimes(1);
    expect(await db.outbox.where('opId').equals(first!).count()).toBe(0);
    expect(await db.outbox.where('opId').equals(second!).first()).toMatchObject(
      {
        state: 'queued',
        attempts: 1,
        lastError: 'HTTP 503',
      },
    );
    expect(await db.outbox.where('opId').equals(third!).first()).toMatchObject({
      state: 'queued',
      attempts: 0,
      lastError: null,
    });
  });

  it('counts an attempt on the batch when the request fails', async () => {
    await queue(2);
    const error = new Error('Failed to fetch');
    const client = vi.fn().mockRejectedValue(error);

    const outcome = await pushOutbox(db, client);

    expect(outcome).toEqual({
      stopped: 'failed',
      applied: 0,
      rejected: 0,
      error,
    });
    const ops = await db.outbox.toArray();
    expect(ops.map((op) => op.attempts)).toEqual([1, 1]);
    expect(ops.map((op) => op.lastError)).toEqual([
      'Failed to fetch',
      'Failed to fetch',
    ]);
    expect(ops.map((op) => op.state)).toEqual(['queued', 'queued']);
  });

  it('sends by batches and skips rejected operations', async () => {
    await queue(3);
    await db.outbox
      .where('seq')
      .equals(2)
      .modify((op) => {
        op.state = 'rejected';
      });
    const client = vi.fn(answering([200, 200]));

    const outcome = await pushOutbox(db, client, { batchSize: 1 });

    expect(outcome).toEqual({ stopped: 'done', applied: 2, rejected: 0 });
    expect(client).toHaveBeenCalledTimes(2);
    expect(await db.outbox.toArray()).toMatchObject([
      { seq: 2, state: 'rejected' },
    ]);
  });
});
