import { SYNC_STATUS, type SyncStatus } from '@repo/contract/sync';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';

const translate = createTranslator(DEFAULT_LOCALE);

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

function isMappingError(error: unknown): boolean {
  return error instanceof TypeError || error instanceof RangeError;
}

/**
 * What the device should make of a failed write. Integrity and type errors,
 * and the guards our own triggers raise (class P0), are the device's to fix
 * (4xx); anything else is the server's, and the operation comes back later.
 */
export type FailureStatus = Exclude<SyncStatus, 200>;

export function statusOf(error: unknown): FailureStatus {
  const state = sqlState(error);
  if (!state) {
    return isMappingError(error) ? SYNC_STATUS.badRequest : SYNC_STATUS.retry;
  }
  if (state === '23505') return SYNC_STATUS.conflict;
  if (state === '23503') return SYNC_STATUS.notFound;
  if (
    state.startsWith('22') ||
    state.startsWith('23') ||
    state.startsWith('P0')
  ) {
    return SYNC_STATUS.badRequest;
  }
  return SYNC_STATUS.retry;
}

const MESSAGE_KEYS = {
  [SYNC_STATUS.badRequest]: 'sync.op.badRequest',
  [SYNC_STATUS.forbidden]: 'sync.op.forbidden',
  [SYNC_STATUS.notFound]: 'sync.op.notFound',
  [SYNC_STATUS.conflict]: 'sync.op.conflict',
  [SYNC_STATUS.retry]: 'sync.op.retry',
} as const;

/** The line the device may show for a status; never the SQL or its parameters. */
export function messageOf(status: FailureStatus): string {
  return translate(MESSAGE_KEYS[status]);
}

/** A write the server refuses before Postgres sees it; `reason` goes to the log only. */
export class SyncRejected extends Error {
  constructor(
    readonly status: Exclude<FailureStatus, 503>,
    readonly reason: string,
  ) {
    super(messageOf(status));
    this.name = 'SyncRejected';
  }
}
