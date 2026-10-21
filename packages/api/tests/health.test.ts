import { beforeEach, describe, expect, it, vi } from 'vitest';

const pingDb = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock('@repo/db', () => ({ pingDb }));

const { appRouter } = await import('#root');

const caller = () => appRouter.createCaller({});

describe('health.check', () => {
  beforeEach(() => {
    pingDb.mockReset();
  });

  it('reports the database as up when it answers', async () => {
    pingDb.mockResolvedValue(undefined);

    await expect(caller().health.check()).resolves.toEqual({
      api: 'up',
      database: 'up',
    });
    expect(pingDb).toHaveBeenCalledTimes(1);
  });

  it('reports the database as down without throwing when it is unreachable', async () => {
    pingDb.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(caller().health.check()).resolves.toEqual({
      api: 'up',
      database: 'down',
    });
  });
});
