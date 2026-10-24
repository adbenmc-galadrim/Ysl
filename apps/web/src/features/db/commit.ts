import { newId } from '@repo/shared/id';
import type {
  CourrierDatabase,
  OutboxOp,
  SyncedEntity,
  SyncedRows,
} from '#/features/db/schema';

export type Upsert = {
  [Entity in SyncedEntity]: { entity: Entity; row: SyncedRows[Entity] };
}[SyncedEntity];

export type Deletion = { entity: SyncedEntity; id: string };

export type LocalWrite = {
  upserts?: readonly Upsert[];
  deletes?: readonly Deletion[];
};

export type CommitOptions = { now?: Date };

export class MissingRowError extends Error {
  constructor(entity: SyncedEntity, id: string) {
    super(`No ${entity} row ${id} to delete`);
    this.name = 'MissingRowError';
  }
}

function queued(
  entity: SyncedEntity,
  entityId: string,
  type: OutboxOp['type'],
  patch: Record<string, unknown>,
  clientTs: Date,
): Omit<OutboxOp, 'seq'> {
  return {
    opId: newId(),
    entity,
    entityId,
    type,
    patch,
    clientTs,
    attempts: 0,
    lastError: null,
  };
}

/**
 * Writes local first (D3): every row and its outbox operation land in one
 * transaction, so a change is either visible and queued for `sync.push`, or
 * neither. Deletes are logical. Returns the operation ids, in order.
 */
export async function commitLocal(
  db: CourrierDatabase,
  { upserts = [], deletes = [] }: LocalWrite,
  { now = new Date() }: CommitOptions = {},
): Promise<string[]> {
  if (!upserts.length && !deletes.length) return [];
  const entities = new Set<SyncedEntity>([
    ...upserts.map((upsert) => upsert.entity),
    ...deletes.map((deletion) => deletion.entity),
  ]);
  const tables = [...entities].map((entity) => db.synced(entity));

  return db.transaction('rw', [...tables, db.outbox], async () => {
    const ops: Omit<OutboxOp, 'seq'>[] = [];
    for (const { entity, row } of upserts) {
      const stamped = { ...row, updatedAt: now };
      await db.synced(entity).put(stamped);
      ops.push(queued(entity, row.id, 'upsert', stamped, now));
    }
    for (const { entity, id } of deletes) {
      const table = db.synced(entity);
      const existing = await table.get(id);
      if (!existing) throw new MissingRowError(entity, id);
      await table.put({ ...existing, deletedAt: now, updatedAt: now });
      ops.push(queued(entity, id, 'delete', { deletedAt: now }, now));
    }
    await db.outbox.bulkAdd(ops);
    return ops.map((op) => op.opId);
  });
}
