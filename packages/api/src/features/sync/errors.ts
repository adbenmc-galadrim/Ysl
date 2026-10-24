import { SYNC_STATUS, type SyncStatus } from '@repo/contract/sync';

/** The SQLSTATE of a failed statement, wherever the driver or drizzle put it. */
export function sqlState(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = cause;
  }
  return undefined;
}

const RETRYABLE = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '55P03', // lock_not_available (lock_timeout)
]);

export function isRetryable(error: unknown): boolean {
  const state = sqlState(error);
  return state !== undefined && RETRYABLE.has(state);
}

/**
 * What the device should make of a failed write. Integrity and type errors
 * are the device's to fix (4xx); anything else is the server's, and the
 * operation comes back later.
 */
export function statusOf(error: unknown): SyncStatus {
  const state = sqlState(error);
  if (!state) return SYNC_STATUS.retry;
  if (state === '23505') return SYNC_STATUS.conflict;
  if (state === '23503') return SYNC_STATUS.notFound;
  if (state.startsWith('22') || state.startsWith('23')) {
    return SYNC_STATUS.badRequest;
  }
  return SYNC_STATUS.retry;
}

/** A write the server refuses before Postgres sees it. */
export class SyncRejected extends Error {
  constructor(
    readonly status: Exclude<SyncStatus, 200 | 503>,
    message: string,
  ) {
    super(message);
    this.name = 'SyncRejected';
  }
}
