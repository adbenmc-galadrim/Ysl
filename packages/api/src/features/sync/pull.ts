import type { AnyDb } from '@repo/db';
import {
  SYNCED_ENTITIES,
  type PullChange,
  type PullInput,
  type PullOutput,
  type PullPage,
} from '@repo/contract/sync';
import { syncGeneration } from '@repo/db/schema';
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { tableOf, type SyncTable } from '#features/sync/tables';

type Row = Record<string, unknown> & { id: string; serverXid: number };

/**
 * The generation, and the oldest transaction still running as the pull
 * starts. Every transaction below that bound has ended: a row stamped below
 * it is visible now or never, so nothing can land behind a cursor set there.
 */
async function snapshot(
  db: AnyDb,
): Promise<{ generation: string; bound: number }> {
  const [row] = await db
    .select({
      generation: syncGeneration.generation,
      bound: sql<string>`pg_snapshot_xmin(pg_current_snapshot())::text`,
    })
    .from(syncGeneration);
  if (!row) throw new Error('sync_generation has no row');
  return { generation: row.generation, bound: Number(row.bound) };
}

async function pageOf(
  db: AnyDb,
  table: SyncTable,
  organizationId: string,
  page: Pick<PullPage, 'from' | 'bound' | 'after'>,
  limit: number,
): Promise<Row[]> {
  const rows = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.organizationId, organizationId),
        gte(table.serverXid, page.from),
        lt(table.serverXid, page.bound),
        page.after
          ? sql`(${table.serverXid}, ${table.id}) > (${page.after.xid}, ${page.after.id})`
          : undefined,
      ),
    )
    .orderBy(asc(table.serverXid), asc(table.id))
    .limit(limit);
  return rows;
}

function withoutOrganization(row: Row): PullChange['row'] {
  const { organizationId: _organizationId, ...rest } = row;
  void _organizationId;
  return rest;
}

/**
 * `sync.pull`: the rows of one mailroom written since the cursor, up to the
 * snapshot bound fixed by the first page, entity after entity in
 * `(server_xid, id)` order. A row may come back twice across two pulls; the
 * device upserts. A cursor from another generation or beyond the bound is
 * unusable: the pull starts over and says so.
 */
export async function pull(
  db: AnyDb,
  organizationId: string,
  input: PullInput,
): Promise<PullOutput> {
  const { generation, bound } = await snapshot(db);
  let reset = false;
  let range: Pick<PullPage, 'from' | 'bound'>;
  let entity = 0;
  let after: PullPage['after'] = null;

  if (input.page) {
    range = { from: input.page.from, bound: input.page.bound };
    entity = input.page.entity;
    after = input.page.after;
  } else {
    const { cursor } = input;
    const usable =
      cursor !== null &&
      cursor.generation === generation &&
      cursor.xid <= bound;
    reset = cursor !== null && !usable;
    range = { from: usable ? cursor.xid : 0, bound };
  }

  const rows: PullChange[] = [];
  let next: PullPage | null = null;
  for (; entity < SYNCED_ENTITIES.length; entity += 1) {
    const name = SYNCED_ENTITIES[entity];
    if (!name) break;
    const room = input.limit - rows.length;
    const page = await pageOf(
      db,
      tableOf(name),
      organizationId,
      { ...range, after },
      room + 1,
    );
    const kept = page.slice(0, room);
    rows.push(
      ...kept.map((row) => ({ entity: name, row: withoutOrganization(row) })),
    );
    if (page.length > room) {
      const last = kept[kept.length - 1];
      next = {
        ...range,
        entity,
        after: last ? { xid: last.serverXid, id: last.id } : after,
      };
      break;
    }
    after = null;
  }

  return { generation, reset, rows, next, cursor: range.bound };
}
