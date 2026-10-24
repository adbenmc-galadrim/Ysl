import { describe, expect, it, vi } from 'vitest';
import { sqlState, statusOf } from '#features/sync/errors';
import { withRetry } from '#features/sync/retry';

const pgError = (code: string) => Object.assign(new Error(code), { code });

describe('withRetry', () => {
  it('runs again after a serialization failure, then succeeds', async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(pgError('40001'))
      .mockRejectedValueOnce(pgError('40P01'))
      .mockResolvedValue('ok');

    await expect(withRetry(run)).resolves.toBe('ok');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt', async () => {
    const run = vi.fn().mockRejectedValue(pgError('55P03'));

    await expect(withRetry(run, 2)).rejects.toMatchObject({ code: '55P03' });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not retry an integrity error', async () => {
    const run = vi.fn().mockRejectedValue(pgError('23505'));

    await expect(withRetry(run)).rejects.toMatchObject({ code: '23505' });
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('statusOf', () => {
  it('reads the SQLSTATE drizzle wraps in a cause', () => {
    const wrapped = Object.assign(new Error('query failed'), {
      cause: pgError('23514'),
    });

    expect(sqlState(wrapped)).toBe('23514');
    expect(statusOf(wrapped)).toBe(400);
  });

  it('classifies integrity errors as the device’s, the rest as the server’s', () => {
    expect(statusOf(pgError('23505'))).toBe(409);
    expect(statusOf(pgError('23503'))).toBe(404);
    expect(statusOf(pgError('23502'))).toBe(400);
    expect(statusOf(pgError('22P02'))).toBe(400);
    expect(statusOf(pgError('53300'))).toBe(503);
    expect(statusOf(new Error('socket hang up'))).toBe(503);
  });
});
