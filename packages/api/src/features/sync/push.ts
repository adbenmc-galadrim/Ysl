import type { AnyDb } from '@repo/db';
import {
  SYNC_STATUS,
  type PushInput,
  type PushOutput,
  type PushResult,
  type SyncOp,
} from '@repo/contract/sync';
import { syncOp as syncOpTable } from '@repo/db/schema';
import { logger } from '@repo/shared/logger';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import {
  type FailureStatus,
  isRetryable,
  messageOf,
  sqlState,
  statusOf,
  SyncRejected,
} from '#features/sync/errors';
import { withRetry } from '#features/sync/retry';
import { tableOf, type SyncTable } from '#features/sync/tables';

export const LOCK_TIMEOUT = '3s';

/** Columns the server owns: a device cannot set or move them. */
const SERVER_COLUMNS = new Set(['organizationId', 'serverXid']);

/** Columns an update leaves alone, whatever the device sends. */
const IMMUTABLE_COLUMNS = new Set([
  'id',
  'organizationId',
  'serverXid',
  'createdAt',
]);

type Writer = {
  organizationId: string;
  userId: string;
};

type Values = Record<string, unknown>;

function valuesOf(table: SyncTable, op: SyncOp): Values {
  const columns = getTableColumns(table);
  const values: Values = {};
  for (const [key, value] of Object.entries(op.patch)) {
    if (SERVER_COLUMNS.has(key)) continue;
    if (!(key in columns)) {
      throw new SyncRejected(
        SYNC_STATUS.badRequest,
        `${op.entity} has no column ${key}`,
      );
    }
    values[key] = value;
  }
  if (values.id !== undefined && values.id !== op.entityId) {
    throw new SyncRejected(
      SYNC_STATUS.badRequest,
      `patch id ${JSON.stringify(values.id)} is not the entity ${op.entityId}`,
    );
  }
  values.id = op.entityId;
  values.updatedAt = values.updatedAt ?? op.clientTs;
  return values;
}

function updatesOf(values: Values): Values {
  const set: Values = {};
  for (const [key, value] of Object.entries(values)) {
    if (IMMUTABLE_COLUMNS.has(key)) continue;
    set[key] = value;
  }
  return set;
}

async function upsert(
  tx: AnyDb,
  op: SyncOp,
  { organizationId }: Writer,
): Promise<void> {
  const table = tableOf(op.entity);
  const values = { ...valuesOf(table, op), organizationId };
  const insert = tx.insert(table).values(values as never);

  if (op.entity === 'event') {
    // Append-only: an id already there is this very event, already received.
    const inserted = await insert
      .onConflictDoNothing({ target: table.id })
      .returning({ id: table.id });
    if (inserted.length === 0) await requireOwn(tx, table, op, organizationId);
    return;
  }

  const updated = await insert
    .onConflictDoUpdate({
      target: table.id,
      set: updatesOf(values),
      setWhere: sql`${table.organizationId} = excluded.organization_id`,
    })
    .returning({ id: table.id });
  if (updated.length === 0) {
    throw new SyncRejected(
      SYNC_STATUS.forbidden,
      `${op.entity} ${op.entityId} belongs to another organization`,
    );
  }
}

async function requireOwn(
  tx: AnyDb,
  table: SyncTable,
  op: SyncOp,
  organizationId: string,
): Promise<void> {
  const [own] = await tx
    .select({ id: table.id })
    .from(table)
    .where(
      and(eq(table.id, op.entityId), eq(table.organizationId, organizationId)),
    )
    .limit(1);
  if (!own) {
    throw new SyncRejected(
      SYNC_STATUS.forbidden,
      `${op.entity} ${op.entityId} belongs to another organization`,
    );
  }
}

async function softDelete(
  tx: AnyDb,
  op: SyncOp,
  { organizationId }: Writer,
): Promise<void> {
  const table = tableOf(op.entity);
  const deletedAt =
    op.patch.deletedAt instanceof Date ? op.patch.deletedAt : op.clientTs;
  const deleted = await tx
    .update(table)
    .set({ deletedAt, updatedAt: op.clientTs })
    .where(
      and(eq(table.id, op.entityId), eq(table.organizationId, organizationId)),
    )
    .returning({ id: table.id });
  if (deleted.length === 0) {
    throw new SyncRejected(
      SYNC_STATUS.notFound,
      `${op.entity} ${op.entityId} is not in this organization`,
    );
  }
}

function syncOpRow(op: SyncOp, writer: Writer, status: number) {
  return {
    organizationId: writer.organizationId,
    opId: op.opId,
    userId: writer.userId,
    entity: op.entity,
    entityId: op.entityId,
    status,
  };
}

/**
 * Claims the operation id. Returns the status recorded by an earlier push
 * when the device already sent it, null when this push is the first.
 */
async function claim(
  tx: AnyDb,
  op: SyncOp,
  writer: Writer,
  status: number,
): Promise<number | null> {
  const claimed = await tx
    .insert(syncOpTable)
    .values(syncOpRow(op, writer, status))
    .onConflictDoNothing()
    .returning({ opId: syncOpTable.opId });
  if (claimed.length > 0) return null;
  const [earlier] = await tx
    .select({ status: syncOpTable.status })
    .from(syncOpTable)
    .where(
      and(
        eq(syncOpTable.organizationId, writer.organizationId),
        eq(syncOpTable.opId, op.opId),
      ),
    );
  return earlier?.status ?? SYNC_STATUS.applied;
}

/** Records a refusal so the same operation sent again gets the same answer. */
async function record(
  db: AnyDb,
  op: SyncOp,
  writer: Writer,
  status: number,
): Promise<void> {
  await db
    .insert(syncOpTable)
    .values(syncOpRow(op, writer, status))
    .onConflictDoNothing();
}

const toStatus = (value: number): PushResult['status'] =>
  value as PushResult['status'];

/**
 * Applies one operation in its own transaction: the op_id is claimed first,
 * so a repeat is answered from `sync_op` without touching the row; the write
 * and the claim commit together. A refused write is rolled back, then its
 * status is recorded so the repeat gets the same answer.
 */
async function applyOne(
  db: AnyDb,
  op: SyncOp,
  writer: Writer,
): Promise<PushResult> {
  try {
    const earlier = await withRetry(() =>
      db.transaction(async (tx) => {
        await tx.execute(sql.raw(`set local lock_timeout = '${LOCK_TIMEOUT}'`));
        const seen = await claim(tx, op, writer, SYNC_STATUS.applied);
        if (seen !== null) return seen;
        if (op.type === 'delete') await softDelete(tx, op, writer);
        else await upsert(tx, op, writer);
        return null;
      }),
    );
    return { opId: op.opId, status: toStatus(earlier ?? SYNC_STATUS.applied) };
  } catch (error) {
    const fields = { opId: op.opId, entity: op.entity, entityId: op.entityId };
    if (error instanceof SyncRejected) {
      logger.warn(
        { ...fields, status: error.status, reason: error.reason },
        'sync op rejected',
      );
      await record(db, op, writer, error.status);
      return { opId: op.opId, status: error.status, message: error.message };
    }
    const status: FailureStatus = isRetryable(error)
      ? SYNC_STATUS.retry
      : statusOf(error);
    logger.warn(
      { ...fields, status, sqlState: sqlState(error), err: error },
      status === SYNC_STATUS.retry ? 'sync op deferred' : 'sync op rejected',
    );
    if (status !== SYNC_STATUS.retry) await record(db, op, writer, status);
    return { opId: op.opId, status, message: messageOf(status) };
  }
}

/**
 * `sync.push`: the operations of one device, in the order it made them,
 * answered one by one. A 503 stops the batch there, since the operations
 * after it may depend on the one that did not go through.
 */
export async function push(
  db: AnyDb,
  writer: Writer,
  input: PushInput,
): Promise<PushOutput> {
  const results: PushResult[] = [];
  for (const op of input.ops) {
    const result = await applyOne(db, op, writer);
    results.push(result);
    if (result.status === SYNC_STATUS.retry) break;
  }
  return { results };
}
