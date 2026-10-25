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
 * (drizzle/0004_transitions_statut.sql, 0005_statuts_reversibles.sql): a
 * status outside the graph of §8.3, a copy that missed a change of status,
 * a delivery a stale copy would undo, a cancellation it would revive, a
 * notification or a delivery without anyone to give it to; and, by its
 * unique index, a person whose e-mail the directory already has (F50).
 */
export const GUARDS = {
  parcel_status_transition: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.transition',
  },
  parcel_status_stale: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.statusStale',
  },
  parcel_delivery_protected: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.delivered',
  },
  handover_cancel_sticky: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.cancelled',
  },
  handover_parcels_sticky: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.handoverParcels',
  },
  parcel_recipient_check: {
    status: SYNC_STATUS.badRequest,
    key: 'sync.op.recipient',
  },
  directory_person_email_idx: {
    status: SYNC_STATUS.conflict,
    key: 'sync.op.directoryEmail',
  },
} as const;

export type Guard = keyof typeof GUARDS;

export function guardOf(error: unknown): Guard | undefined {
  const constraint = constraintOf(error);
  return constraint && Object.hasOwn(GUARDS, constraint)
    ? (constraint as Guard)
    : undefined;
}

/** Longest `sync_op.reason`, whatever raised it. */
export const REASON_MAX = 300;

/**
 * What to keep of a refusal in `sync_op.reason`: the constraint and the line
 * its trigger or check raised, or just the SQLSTATE or error name. Postgres
 * repeats the offending value in its other messages (`invalid input syntax
 * for type uuid: "…"`), and drizzle's own message carries every parameter:
 * neither is kept.
 */
export function reasonOf(error: unknown): string {
  const constraint = constraintOf(error);
  if (constraint) {
    const raised = messageOfConstraint(error, constraint) ?? '';
    return `${constraint}: ${raised}`.slice(0, REASON_MAX);
  }
  return sqlState(error) ?? (error instanceof Error ? error.name : 'error');
}

function messageOfConstraint(
  error: unknown,
  constraint: string,
): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const fields = current as PgFields;
    if (
      fields.constraint === constraint &&
      typeof fields.message === 'string'
    ) {
      return fields.message;
    }
    current = fields.cause;
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

/**
 * A write the server refuses before Postgres sees it. `reason` goes to the
 * log and to `sync_op.reason`: identifiers and column names, never a value
 * the device sent.
 */
export class SyncRejected extends Error {
  constructor(
    readonly status: Exclude<FailureStatus, 503>,
    readonly reason: string,
  ) {
    super(messageOf(status));
    this.name = 'SyncRejected';
  }
}
