import {
  PULL_PAGE_DEFAULT,
  type PullChange,
  type PullInput,
  type PullOutput,
  type SyncCursor,
  type SyncedEntity,
} from '@repo/contract/sync';
import { PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import {
  SYNC_STATE_KEYS,
  SYNCED_TABLE_NAMES,
  type CourrierDatabase,
  type SyncedRows,
} from '#/features/db/schema';

export type PullClient = (input: PullInput) => Promise<PullOutput>;

export type PullOptions = {
  limit?: number;
  /** Called after each page with the rows written so far: the first pull shows it. */
  onProgress?: (rows: number) => void;
};

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
 * What a removed parcel leaves behind on this device: its events and what
 * the reader made of its label. Its photos go with the local purge.
 */
async function dropParcelTraces(db: CourrierDatabase, ids: string[]) {
  if (ids.length === 0) return;
  await db.event
    .where('[entity+entityId]')
    .anyOf(ids.map((id) => [PARCEL_EVENT_ENTITY, id]))
    .delete();
  await db.extraction.bulkDelete(ids);
}

/**
 * Writes one page into the local tables. A row with a queued change of this
 * device is left alone: its push will carry the newer version. A row the
 * server marked deleted leaves the device: no tombstone is kept here, so a
 * purge on the server (§9.2) purges the phone too.
 */
export async function applyChanges(
  db: CourrierDatabase,
  changes: PullChange[],
): Promise<number> {
  if (changes.length === 0) return 0;
  const groups = byEntity(changes);
  const tables = [...groups.keys()].map((entity) => db.synced(entity));
  return db.transaction(
    'rw',
    [...tables, db.outbox, db.event, db.extraction],
    async () => {
      const pending = await pendingKeys(db);
      let written = 0;
      for (const [entity, rows] of groups) {
        const kept = rows.filter(
          (row) => !pending.has(keyOf(entity, row.id as string)),
        );
        const gone = kept
          .filter((row) => row.deletedAt != null)
          .map((row) => row.id as string);
        const live = kept.filter((row) => row.deletedAt == null);
        await db.synced(entity).bulkPut(live as SyncedRows[typeof entity][]);
        await db.synced(entity).bulkDelete(gone);
        if (entity === 'parcel') await dropParcelTraces(db, gone);
        written += kept.length;
      }
      return written;
    },
  );
}

/** Every row with an operation in the outbox, queued or refused: its only copy may be here. */
async function outboxKeys(db: CourrierDatabase): Promise<Set<string>> {
  const ops = await db.outbox.toArray();
  return new Set(ops.map((op) => keyOf(op.entity, op.entityId)));
}

/**
 * After a reset, the rows the server no longer has: whatever the full read
 * did not bring back, except a row with an operation still in the outbox.
 */
async function sweepUnseen(
  db: CourrierDatabase,
  seen: Set<string>,
): Promise<void> {
  const tables = SYNCED_TABLE_NAMES.map((entity) => db.synced(entity));
  await db.transaction(
    'rw',
    [...tables, db.outbox, db.event, db.extraction],
    async () => {
      const pending = await outboxKeys(db);
      for (const entity of SYNCED_TABLE_NAMES) {
        const ids = await db.synced(entity).toCollection().primaryKeys();
        const unseen = ids.filter(
          (id) =>
            !seen.has(keyOf(entity, id)) && !pending.has(keyOf(entity, id)),
        );
        await db.synced(entity).bulkDelete(unseen);
        if (entity === 'parcel') await dropParcelTraces(db, unseen);
      }
    },
  );
}

type Read = {
  generation: string;
  reset: boolean;
  rows: number;
  bound: number;
  /** Every row the read brought, since it last started from zero. */
  seen: Set<string>;
};

/**
 * One read from `cursor` to the bound of its first page. A later page may
 * say `reset` too, when a purge erased a mark of the range meanwhile: the
 * read has started over from zero, so what was seen before no longer counts.
 */
async function readFrom(
  db: CourrierDatabase,
  client: PullClient,
  cursor: SyncCursor | null,
  limit: number,
  progress: (rows: number) => void,
): Promise<Read> {
  let output = await client({ cursor, page: null, limit });
  const { generation } = output;
  let reset = output.reset;
  const seen = new Set<string>();
  let rows = 0;
  for (;;) {
    if (output.reset) {
      reset = true;
      seen.clear();
    }
    for (const { entity, row } of output.rows) seen.add(keyOf(entity, row.id));
    rows += await applyChanges(db, output.rows);
    progress(rows);
    if (!output.next) break;
    output = await client({ cursor: null, page: output.next, limit });
  }
  return { generation, reset, rows, bound: output.cursor, seen };
}

/**
 * Pulls everything the server wrote since the cursor, page after page, and
 * moves the cursor only once the last page is in: a pull cut short starts
 * again from the same place, and a row that comes twice is put twice.
 *
 * A reset reads everything again, then drops what did not come back: rows
 * the server erased while this device was too far behind to see them go.
 * A row rewritten while the full read ran is above its bound and missing
 * from it, so a second read from that bound comes first: only what neither
 * brought back is dropped.
 */
export async function pullChanges(
  db: CourrierDatabase,
  client: PullClient,
  { limit = PULL_PAGE_DEFAULT, onProgress }: PullOptions = {},
): Promise<PullOutcome> {
  let done = 0;
  const progress = (rows: number) => onProgress?.(done + rows);
  const first = await readFrom(
    db,
    client,
    await readCursor(db),
    limit,
    progress,
  );
  const { generation, reset } = first;
  let rows = first.rows;
  let bound = first.bound;
  if (reset) {
    done = rows;
    const again = await readFrom(
      db,
      client,
      { generation, xid: bound },
      limit,
      progress,
    );
    rows += again.rows;
    bound = again.bound;
    const seen = again.reset
      ? again.seen
      : new Set([...first.seen, ...again.seen]);
    await sweepUnseen(db, seen);
  }
  const next: SyncCursor = { generation, xid: bound };
  await db.syncState.put({ key: SYNC_STATE_KEYS.cursor, value: next });
  return { rows, reset, cursor: next };
}
