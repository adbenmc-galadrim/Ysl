import type { UserRole } from '@repo/contract/auth';
import {
  canMoveNotification,
  notificationRow,
  presetTemplateId,
  type NotificationStatus,
} from '@repo/contract/mail';
import { isSettingKey, SETTING_VALUES } from '@repo/contract/settings';
import type { AnyDb } from '@repo/db';
import {
  SYNC_STATUS,
  type PushInput,
  type PushOutput,
  type PushResult,
  type SyncOp,
} from '@repo/contract/sync';
import {
  emailTemplate,
  notification,
  syncOp as syncOpTable,
} from '@repo/db/schema';
import { logger } from '@repo/shared/logger';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import {
  type FailureStatus,
  guardOf,
  isRetryable,
  messageOf,
  REASON_MAX,
  reasonOf,
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
  role: UserRole;
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
      `patch id is not the entity ${op.entityId}`,
    );
  }
  values.id = op.entityId;
  values.updatedAt = values.updatedAt ?? op.clientTs;
  return values;
}

/**
 * What an update may change: not the server columns, and a deletion stays.
 * A device that still holds the row as alive sends it whole; without this,
 * the stale copy would bring a deleted row back (§8.4: deletes are logical).
 */
function updatesOf(table: SyncTable, values: Values): Values {
  const set: Values = {};
  for (const [key, value] of Object.entries(values)) {
    if (IMMUTABLE_COLUMNS.has(key)) continue;
    set[key] = value;
  }
  if ('deletedAt' in set) {
    set.deletedAt = sql`coalesce(${table.deletedAt}, excluded.deleted_at)`;
  }
  return set;
}

/**
 * The settings of the mailroom are the admin's (§529): a device signed in as
 * an agent cannot change them, and a value that does not match its key would
 * end up in every e-mail.
 */
function checkSetting(op: SyncOp, { role }: Writer): void {
  if (role !== 'admin') {
    throw new SyncRejected(
      SYNC_STATUS.forbidden,
      `setting ${op.entityId} written by a non-admin`,
      'sync.op.adminOnly',
    );
  }
  if (op.type === 'delete') return;
  const { key, value } = op.patch;
  if (!isSettingKey(key) || !SETTING_VALUES[key].safeParse(value).success) {
    throw new SyncRejected(
      SYNC_STATUS.badRequest,
      `setting ${op.entityId} has no valid value for its key`,
    );
  }
}

/**
 * Templates are each agent's own (D2): written by their owner only. The
 * default one, which every mail falls back on, is not deleted while it is
 * the default; the one the app ships with (`presetTemplateId`) is restored,
 * never deleted, even once another took its place.
 */
async function checkTemplate(
  tx: AnyDb,
  op: SyncOp,
  { organizationId, userId }: Writer,
): Promise<void> {
  const [row] = await tx
    .select({
      ownerId: emailTemplate.ownerId,
      isDefault: emailTemplate.isDefault,
      type: emailTemplate.type,
    })
    .from(emailTemplate)
    .where(
      and(
        eq(emailTemplate.id, op.entityId),
        eq(emailTemplate.organizationId, organizationId),
      ),
    );
  const owner = op.type === 'upsert' ? op.patch.ownerId : row?.ownerId;
  if (
    (row && row.ownerId !== userId) ||
    (owner !== undefined && owner !== userId)
  ) {
    throw new SyncRejected(
      SYNC_STATUS.forbidden,
      `email_template ${op.entityId} written by another agent`,
      'sync.op.templateOwner',
    );
  }
  const deleting =
    op.type === 'delete' || (op.patch.deletedAt ?? null) !== null;
  if (!deleting) return;
  const types = [op.type === 'upsert' ? op.patch.type : undefined, row?.type];
  const isDefault =
    row?.isDefault === true ||
    (op.type === 'upsert' && op.patch.isDefault === true);
  let isPreset = false;
  for (const type of types)
    if (typeof type === 'string')
      isPreset ||= op.entityId === (await presetTemplateId(userId, type));
  if (isDefault || isPreset) {
    throw new SyncRejected(
      SYNC_STATUS.conflict,
      `email_template ${op.entityId} is a default template`,
      'sync.op.defaultTemplate',
    );
  }
}

/**
 * A mail is declared by the agent who prepared it (S5): the row has the shape
 * of the contract, and nobody else moves it.
 */
async function checkNotification(
  tx: AnyDb,
  op: SyncOp,
  { organizationId, userId }: Writer,
): Promise<void> {
  if (
    op.type === 'upsert' &&
    !notificationRow.safeParse({ ...op.patch, id: op.entityId }).success
  ) {
    throw new SyncRejected(
      SYNC_STATUS.badRequest,
      `notification ${op.entityId} does not match the contract`,
    );
  }
  const [row] = await tx
    .select({
      preparedBy: notification.preparedBy,
      status: notification.status,
    })
    .from(notification)
    .where(
      and(
        eq(notification.id, op.entityId),
        eq(notification.organizationId, organizationId),
      ),
    );
  const author = op.type === 'upsert' ? op.patch.preparedBy : undefined;
  if (
    (row && row.preparedBy !== userId) ||
    (author !== undefined && author !== userId)
  ) {
    throw new SyncRejected(
      SYNC_STATUS.forbidden,
      `notification ${op.entityId} written by another agent`,
      'sync.op.notificationOwner',
    );
  }
  if (
    op.type === 'upsert' &&
    row &&
    row.status !== op.patch.status &&
    !canMoveNotification(row.status, op.patch.status as NotificationStatus)
  ) {
    throw new SyncRejected(
      SYNC_STATUS.conflict,
      `notification ${op.entityId} cannot go from ${row.status} to ${String(op.patch.status)}`,
      'sync.op.notificationStale',
    );
  }
}

async function upsert(tx: AnyDb, op: SyncOp, writer: Writer): Promise<void> {
  const { organizationId } = writer;
  const table = tableOf(op.entity);
  const values: Values = { ...valuesOf(table, op), organizationId };
  if (op.entity === 'setting') values.updatedBy = writer.userId;
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
      set: updatesOf(table, values),
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

function syncOpRow(
  op: SyncOp,
  writer: Writer,
  status: number,
  reason: string | null = null,
) {
  return {
    organizationId: writer.organizationId,
    opId: op.opId,
    userId: writer.userId,
    entity: op.entity,
    entityId: op.entityId,
    status,
    reason,
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

/**
 * Records a refusal, with why, so the same operation sent again gets the same
 * answer and the conflicts of §8.4 can be read back (`sync_op.reason`).
 */
async function record(
  db: AnyDb,
  op: SyncOp,
  writer: Writer,
  status: number,
  reason: string,
): Promise<void> {
  await db
    .insert(syncOpTable)
    .values(syncOpRow(op, writer, status, reason.slice(0, REASON_MAX)))
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
        if (op.entity === 'setting') checkSetting(op, writer);
        if (op.entity === 'email_template') await checkTemplate(tx, op, writer);
        if (op.entity === 'notification') {
          await checkNotification(tx, op, writer);
        }
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
      await record(db, op, writer, error.status, error.reason);
      return { opId: op.opId, status: error.status, message: error.message };
    }
    const status: FailureStatus = isRetryable(error)
      ? SYNC_STATUS.retry
      : statusOf(error);
    const guard = guardOf(error);
    logger.warn(
      { ...fields, status, guard, sqlState: sqlState(error), err: error },
      status === SYNC_STATUS.retry ? 'sync op deferred' : 'sync op rejected',
    );
    if (status !== SYNC_STATUS.retry) {
      await record(db, op, writer, status, reasonOf(error));
    }
    return { opId: op.opId, status, message: messageOf(status, guard) };
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
