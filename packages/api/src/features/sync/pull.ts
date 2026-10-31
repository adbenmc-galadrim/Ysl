import type { AnyDb } from '@repo/db';
import {
  SYNCED_ENTITIES,
  type PullChange,
  type PullInput,
  type PullOutput,
  type PullPage,
} from '@repo/contract/sync';
import { TOUR_STATUSES } from '@repo/contract/parcel-status';
import {
  department,
  emailTemplate,
  event,
  syncGeneration,
} from '@repo/db/schema';
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { parcelScope, type Access, type ParcelScope } from '#lib/access';
import { purgeHorizon } from '#features/maintenance/purge';
import { readerGeneration, visibleRows } from '#features/sync/scope';
import { tableOf, type SyncTable } from '#features/sync/tables';

type Row = Record<string, unknown> & { id: string; serverXid: number };

/**
 * A pull from zero (first launch, reset) skips the events older than this:
 * the journal is the bulk of a mailroom's rows and a phone only needs the
 * recent ones. A pull from a cursor still carries every new event.
 */
export const EVENT_HORIZON_DAYS = 90;

const horizon = (now: Date) =>
  new Date(now.getTime() - EVENT_HORIZON_DAYS * 24 * 60 * 60 * 1000);

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
  access: Access,
  page: Pick<PullPage, 'from' | 'bound' | 'after'>,
  limit: number,
  now: Date,
): Promise<Row[]> {
  const inRange = and(
    gte(table.serverXid, page.from),
    lt(table.serverXid, page.bound),
  );
  const rows = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.organizationId, access.organizationId),
        table === emailTemplate
          ? eq(emailTemplate.ownerId, access.userId)
          : undefined,
        visibleRows(
          table,
          parcelScope(access),
          access.organizationId,
          page,
          inRange,
        ),
        table === event && page.from === 0
          ? gte(event.at, horizon(now))
          : undefined,
        page.after
          ? sql`(${table.serverXid}, ${table.id}) > (${page.after.xid}, ${page.after.id})`
          : undefined,
      ),
    )
    .orderBy(asc(table.serverXid), asc(table.id))
    .limit(limit);
  return rows;
}

function withoutServerColumns(row: Row): PullChange['row'] {
  const {
    organizationId: _organizationId,
    scopeXid: _scopeXid,
    tourShuttleId: _tourShuttleId,
    formerShuttleIds: _formerShuttleIds,
    ...rest
  } = row;
  void _organizationId;
  void _scopeXid;
  void _tourShuttleId;
  void _formerShuttleIds;
  return rest;
}

/**
 * A PWA of before has no screen for the statuses of a tour and would take a
 * stale copy for true: the parcel leaves it as a removed row would, and comes
 * back with its next write. Its copy is refused by `parcel_status_guard`.
 */
function forReader(
  name: (typeof SYNCED_ENTITIES)[number],
  row: Row,
  input: PullInput,
  now: Date,
  scope: ParcelScope,
): Row {
  if (name !== 'parcel' || row.deletedAt) return row;
  if (
    scope.kind === 'tour' &&
    (row.tourShuttleId ?? row.receivedBy) !== scope.shuttleId
  ) {
    return { ...row, deletedAt: now };
  }
  if (input.tourStatuses) return row;
  return (TOUR_STATUSES as readonly unknown[]).includes(row.status)
    ? { ...row, deletedAt: now }
    : row;
}

/**
 * Where a device must have read past to keep its copy: a purge's horizon, or
 * the last time a row left the reader's department.
 */
async function isStale(
  db: AnyDb,
  { organizationId }: Access,
  scope: ReturnType<typeof parcelScope>,
  from: number,
): Promise<boolean> {
  if (from < (await purgeHorizon(db, organizationId))) return true;
  if (scope.kind !== 'department') return false;
  const [row] = await db
    .select({ scopeXid: department.scopeXid })
    .from(department)
    .where(eq(department.id, scope.departmentId));
  return row?.scopeXid != null && from <= row.scopeXid;
}

/**
 * `sync.pull`: the rows the reader reaches written since the cursor (of the
 * e-mail templates, its own: D2), up to the
 * snapshot bound fixed by the first page, entity after entity in
 * `(server_xid, id)` order. A row may come back twice across two pulls; the
 * device upserts. A cursor from another generation, beyond the bound, or
 * below the purge horizon (a mark it never pulled was erased since) is
 * unusable: the pull starts over and says so. So is one from before a row
 * left the reader's department, or before the reader changed scope: nothing
 * else would take those rows off the device.
 */
export async function pull(
  db: AnyDb,
  access: Access,
  input: PullInput,
  now = new Date(),
): Promise<PullOutput> {
  const scope = parcelScope(access);
  const { generation: serverGeneration, bound } = await snapshot(db);
  const generation = readerGeneration(serverGeneration, scope);
  let reset = false;
  let range: Pick<PullPage, 'from' | 'bound'>;
  let entity = 0;
  let after: PullPage['after'] = null;

  if (input.page) {
    range = { from: input.page.from, bound: input.page.bound };
    entity = input.page.entity;
    after = input.page.after;
    // A purge may have erased a mark of this range since the first page, or a
    // row left the department: the device would never see it go, so the read
    // starts over.
    if (range.from > 0 && (await isStale(db, access, scope, range.from))) {
      reset = true;
      range = { from: 0, bound: range.bound };
      entity = 0;
      after = null;
    }
  } else {
    const { cursor } = input;
    const usable =
      cursor !== null &&
      cursor.generation === generation &&
      cursor.xid <= bound &&
      !(await isStale(db, access, scope, cursor.xid));
    reset = cursor !== null && !usable;
    range = { from: usable ? cursor.xid : 0, bound };
  }

  const rows: PullChange[] = [];
  let next: PullPage | null = null;
  for (; entity < SYNCED_ENTITIES.length; entity += 1) {
    const name = SYNCED_ENTITIES[entity];
    if (!name) break;
    if (name === 'department' && !input.departments) continue;
    if (name === 'deposit' && !input.deposits) continue;
    const room = input.limit - rows.length;
    const page = await pageOf(
      db,
      tableOf(name),
      access,
      { ...range, after },
      room + 1,
      now,
    );
    const kept = page.slice(0, room);
    rows.push(
      ...kept.map((row) => ({
        entity: name,
        row: withoutServerColumns(forReader(name, row, input, now, scope)),
      })),
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
