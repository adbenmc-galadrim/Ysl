import { SYNC_STATUS, type SyncStatus } from '@repo/contract/sync';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';

const translate = createTranslator(DEFAULT_LOCALE);

type PgFields = {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
  cause?: unknown;
};

function pgField<K extends 'code' | 'constraint' | 'message'>(
  error: unknown,
  field: K,
  accept: (value: string) => boolean = () => true,
): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const fields = current as PgFields;
    const value = fields[field];
    if (typeof value === 'string' && accept(value)) return value;
    current = fields.cause;
  }
  return undefined;
}

/** The SQLSTATE of a failed statement, wherever the driver or drizzle put it. */
export function sqlState(error: unknown): string | undefined {
  return pgField(error, 'code', (code) => /^[0-9A-Z]{5}$/.test(code));
}

/** The constraint, or the guard raised `USING CONSTRAINT`, that refused the write. */
export function constraintOf(error: unknown): string | undefined {
  return pgField(error, 'constraint');
}

/**
 * The guards of §8.4, by the constraint name their trigger or check raises
 * (drizzle/0004_transitions_statut.sql): a status outside the graph of §8.3,
 * a delivery a stale copy would undo, a cancellation it would revive, a
 * notification or a delivery without anyone to give it to.
 */
export const GUARDS = {
  parcel_status_transition: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.transition',
  },
  parcel_delivery_protected: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.delivered',
  },
  handover_cancel_sticky: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.cancelled',
  },
  parcel_recipient_check: {
    status: SYNC_STATUS.badRequest,
    key: 'sync.op.recipient',
  },
} as const;

export type Guard = keyof typeof GUARDS;

export function guardOf(error: unknown): Guard | undefined {
  const constraint = constraintOf(error);
  return constraint && constraint in GUARDS ? (constraint as Guard) : undefined;
}

const REASON_MAX = 300;

/**
 * What to keep of a refusal in `sync_op.reason`: the constraint or SQLSTATE
 * and the message of the statement, never its parameters.
 */
export function reasonOf(error: unknown): string {
  const constraint = constraintOf(error);
  const state = sqlState(error);
  const statement = innermost(error, (fields) =>
    constraint
      ? fields.constraint === constraint
      : state !== undefined && fields.code === state,
  );
  const source =
    constraint ?? state ?? (error instanceof Error ? error.name : 'error');
  const message = statement?.message ?? pgField(error, 'message') ?? '';
  return `${source}: ${message}`.slice(0, REASON_MAX);
}

/** The error of the chain the driver raised, not drizzle's "Failed query" and its parameters. */
function innermost(
  error: unknown,
  matches: (fields: PgFields) => boolean,
): { message?: string } | undefined {
  let current: unknown = error;
  let found: PgFields | undefined;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const fields = current as PgFields;
    if (matches(fields)) found = fields;
    current = fields.cause;
  }
  return found && typeof found.message === 'string'
    ? { message: found.message }
    : undefined;
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
  const guard = guardOf(error);
  if (guard) return GUARDS[guard].status;
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

/**
 * The line the device may show for a refusal, by its guard when one raised,
 * by its status otherwise; never the SQL or its parameters.
 */
export function messageOf(status: FailureStatus, guard?: Guard): string {
  return translate(guard ? GUARDS[guard].key : MESSAGE_KEYS[status]);
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
