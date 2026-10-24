import {
  PULL_PAGE_DEFAULT,
  type PullChange,
  type PullInput,
  type PullOutput,
  type SyncCursor,
  type SyncedEntity,
} from '@repo/contract/sync';
import {
  SYNC_STATE_KEYS,
  type CourrierDatabase,
  type SyncedRows,
} from '#/features/db/schema';

export type PullClient = (input: PullInput) => Promise<PullOutput>;

export type PullOptions = { limit?: number };

export type PullOutcome = { rows: number; reset: boolean; cursor: SyncCursor };

export async function readCursor(
  db: CourrierDatabase,
): Promise<SyncCursor | null> {
  const entry = await db.syncState.get(SYNC_STATE_KEYS.cursor);
  return (entry?.value as SyncCursor | undefined) ?? null;
}

const keyOf = (entity: SyncedEntity, id: string) => `${entity}:${id}`;

/** The rows this device changed and has not sent yet: the server copy must not win over them. */
async function pendingKeys(db: CourrierDatabase): Promise<Set<string>> {
  const queued = await db.outbox.where('state').equals('queued').toArray();
  return new Set(queued.map((op) => keyOf(op.entity, op.entityId)));
}

function byEntity(
  changes: PullChange[],
): Map<SyncedEntity, Record<string, unknown>[]> {
  const groups = new Map<SyncedEntity, Record<string, unknown>[]>();
  for (const { entity, row } of changes) {
    const group = groups.get(entity) ?? [];
    group.push(row);
    groups.set(entity, group);
  }
  return groups;
}

/**
 * Writes one page into the local tables. A row with a queued change of this
 * device is left alone: its push will carry the newer version.
 */
export async function applyChanges(
  db: CourrierDatabase,
  changes: PullChange[],
): Promise<number> {
  if (changes.length === 0) return 0;
  const groups = byEntity(changes);
  const tables = [...groups.keys()].map((entity) => db.synced(entity));
  return db.transaction('rw', [...tables, db.outbox], async () => {
    const pending = await pendingKeys(db);
    let written = 0;
    for (const [entity, rows] of groups) {
      const kept = rows.filter(
        (row) => !pending.has(keyOf(entity, row.id as string)),
      );
      await db.synced(entity).bulkPut(kept as SyncedRows[typeof entity][]);
      written += kept.length;
    }
    return written;
  });
}

/**
 * Pulls everything the server wrote since the cursor, page after page, and
 * moves the cursor only once the last page is in: a pull cut short starts
 * again from the same place, and a row that comes twice is put twice.
 */
export async function pullChanges(
  db: CourrierDatabase,
  client: PullClient,
  { limit = PULL_PAGE_DEFAULT }: PullOptions = {},
): Promise<PullOutcome> {
  const cursor = await readCursor(db);
  let output = await client({ cursor, page: null, limit });
  const { generation, reset } = output;
  let rows = await applyChanges(db, output.rows);
  while (output.next) {
    output = await client({ cursor: null, page: output.next, limit });
    rows += await applyChanges(db, output.rows);
  }
  const next: SyncCursor = { generation, xid: output.cursor };
  await db.syncState.put({ key: SYNC_STATE_KEYS.cursor, value: next });
  return { rows, reset, cursor: next };
}
