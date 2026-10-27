import type { AnyDb } from '@repo/db';
import {
  cutoff,
  RETENTION,
  type PurgeCounts,
  type PurgeRun,
  type PurgeTable,
  type PurgeTrigger,
} from '@repo/contract/retention';
import { organization, purgeRun } from '@repo/db/schema';
import { logger } from '@repo/shared/logger';
import { and, desc, eq, isNotNull, sql, type SQL } from 'drizzle-orm';

/** Rows per transaction: short enough never to hold back a pull (YSL-28). */
export const PURGE_BATCH = 500;

/** One purge at a time across every instance of the API. */
const LOCK = sql`hashtext('ysl.retention-purge')`;

type Counted = { n: number; xid: number | null };

type Cutoffs = {
  parcel: Date;
  contact: Date;
  inactivePerson: Date;
  tombstone: Date;
  syncOp: Date;
};

function cutoffsAt(now: Date): Cutoffs {
  return {
    parcel: cutoff(now, RETENTION.parcel),
    contact: cutoff(now, RETENTION.contact),
    inactivePerson: cutoff(now, RETENTION.inactivePerson),
    tombstone: cutoff(now, RETENTION.tombstone),
    syncOp: cutoff(now, RETENTION.syncOp),
  };
}

/** The rows of a raw query, the same through node-postgres and PGlite. */
async function rowsOf<Row>(db: AnyDb, query: SQL): Promise<Row[]> {
  const result: unknown = await db.execute(query);
  return (result as { rows: Row[] }).rows;
}

async function counted(db: AnyDb, query: SQL): Promise<Counted> {
  const [row] = await rowsOf<{ n: number | string; xid: string | null }>(
    db,
    query,
  );
  return {
    n: Number(row?.n ?? 0),
    xid: row?.xid == null ? null : Number(row.xid),
  };
}

/** Runs `step` in short transactions until a batch comes back short. */
async function inBatches(
  db: AnyDb,
  step: (tx: AnyDb) => Promise<Counted>,
): Promise<Counted> {
  let n = 0;
  let xid: number | null = null;
  for (;;) {
    const batch = await db.transaction((tx) => step(tx));
    n += batch.n;
    if (batch.xid !== null) xid = Math.max(xid ?? 0, batch.xid);
    if (batch.n < PURGE_BATCH) return { n, xid };
  }
}

/** A live row of `table` whose `columns` name `id`. */
function liveReference(table: string, columns: string[], id: SQL): SQL {
  return sql`exists (select 1 from ${sql.raw(table)} r where r.organization_id = t.organization_id and r.deleted_at is null and (${sql.join(
    columns.map((column) => sql`${sql.raw(`r.${column}`)} = ${id}`),
    sql` or `,
  )}))`;
}

/** Any row, live or marked, of `table` whose `columns` name `id`. */
function anyReference(table: string, columns: string[], id: SQL): SQL {
  return sql`exists (select 1 from ${sql.raw(table)} r where r.organization_id = t.organization_id and (${sql.join(
    columns.map((column) => sql`${sql.raw(`r.${column}`)} = ${id}`),
    sql` or `,
  )}))`;
}

/** A parcel, handover, notification or pickup code still pointing at a person or a contact. */
function recipientInUse(
  column: 'person_id' | 'contact_id',
  reference: typeof liveReference,
): SQL {
  const id = sql.raw('t.id');
  return sql`(${sql.join(
    ['parcel', 'notification', 'handover', 'pickup_code'].map((table) =>
      reference(table, [column], id),
    ),
    sql` or `,
  )})`;
}

/** Marks up to a batch of live rows of `table` matching `where`: they leave every iPhone at its next pull. */
function mark(
  organizationId: string,
  table: PurgeTable,
  now: Date,
  where: SQL,
): (tx: AnyDb) => Promise<Counted> {
  const name = sql.raw(`"${table}"`);
  return (tx) =>
    counted(
      tx,
      sql`with picked as (
        select t.id from ${name} t
         where t.organization_id = ${organizationId}
           and t.deleted_at is null
           and (${where})
         order by t.id
         limit ${PURGE_BATCH}
         for update skip locked
      ), marked as (
        update ${name} set deleted_at = ${now}, updated_at = ${now}
          from picked where ${name}.id = picked.id
        returning 1
      )
      select count(*)::int as n, null as xid from marked`,
    );
}

/**
 * Erases up to a batch of rows of `table` marked before the tombstone cutoff
 * and not held by `keep`. Returns the newest `server_xid` erased: the
 * horizon below which a device may have missed a mark.
 */
function erase(
  organizationId: string,
  table: PurgeTable,
  before: Date,
  keep: SQL | null = null,
): (tx: AnyDb) => Promise<Counted> {
  const name = sql.raw(`"${table}"`);
  return async (tx) => {
    const picked = sql`select t.id from ${name} t
       where t.organization_id = ${organizationId}
         and t.deleted_at is not null
         and t.deleted_at < ${before}
         ${keep ? sql`and not (${keep})` : sql``}
       order by t.id
       limit ${PURGE_BATCH}
       for update skip locked`;
    return counted(
      tx,
      sql`with picked as (${picked}),
      erased as (
        delete from ${name} using picked where ${name}.id = picked.id
        returning ${name}.server_xid
      )
      select count(*)::int as n, max(server_xid)::text as xid from erased`,
    );
  };
}

function add(
  counts: PurgeCounts,
  table: PurgeTable,
  key: 'marked' | 'deleted',
  n: number,
) {
  if (n === 0) return;
  const entry = counts[table] ?? { marked: 0, deleted: 0 };
  entry[key] += n;
  counts[table] = entry;
}

export type OrganizationPurge = { counts: PurgeCounts; horizonXid: number };

/**
 * The retention purge of one mailroom (§9.2), in two passes. First the rows
 * past their time get `deleted_at`, which every iPhone pulls and applies.
 * Then the rows marked longer ago than the tombstone delay are erased, the
 * children before what they point to; the event log goes with its parcels,
 * under the purge flag its trigger asks for. Every step works by batches in
 * short transactions.
 */
export async function purgeOrganization(
  db: AnyDb,
  organizationId: string,
  now: Date,
): Promise<OrganizationPurge> {
  const at = cutoffsAt(now);
  const counts: PurgeCounts = {};
  let horizon = 0;

  const marks: [PurgeTable, SQL][] = [
    [
      'parcel',
      sql`(t.status = 'remis' and t.delivered_at < ${at.parcel}) or (t.status = 'retourne' and t.updated_at < ${at.parcel})`,
    ],
    [
      'handover',
      sql`not exists (select 1 from parcel p where p.organization_id = t.organization_id and p.id = any(t.parcel_ids) and p.deleted_at is null)`,
    ],
    [
      'notification',
      sql`not exists (select 1 from parcel p where p.organization_id = t.organization_id and p.id = any(t.parcel_ids) and p.deleted_at is null)`,
    ],
    ['pickup_code', sql`coalesce(t.used_at, t.expires_at) < ${at.parcel}`],
    [
      'batch',
      sql`coalesce(t.ended_at, t.started_at) < ${at.parcel} and not ${liveReference('parcel', ['batch_id'], sql.raw('t.id'))}`,
    ],
    [
      'contact',
      sql`coalesce(t.last_used_at, t.updated_at) < ${at.contact} and not ${recipientInUse('contact_id', liveReference)}`,
    ],
    [
      'directory_person',
      sql`t.active = false and t.updated_at < ${at.inactivePerson} and not ${recipientInUse('person_id', liveReference)}`,
    ],
  ];
  for (const [table, where] of marks) {
    const { n } = await inBatches(db, mark(organizationId, table, now, where));
    add(counts, table, 'marked', n);
  }

  const erasures: [PurgeTable, SQL | null][] = [
    ['handover', null],
    ['notification', null],
    ['pickup_code', null],
    ['parcel', null],
    ['batch', anyReference('parcel', ['batch_id'], sql.raw('t.id'))],
    ['sender_account', null],
    ['sender', anyReference('sender_account', ['sender_id'], sql.raw('t.id'))],
    ['email_template', null],
    ['setting', null],
    ['contact', recipientInUse('contact_id', anyReference)],
    ['directory_person', recipientInUse('person_id', anyReference)],
  ];
  for (const [table, keep] of erasures) {
    if (table === 'parcel') {
      const erased = await eraseParcelsWithEvents(
        db,
        organizationId,
        at.tombstone,
      );
      add(counts, 'event', 'deleted', erased.events);
      add(counts, 'parcel', 'deleted', erased.n);
      if (erased.xid !== null) horizon = Math.max(horizon, erased.xid + 1);
      continue;
    }
    const { n, xid } = await inBatches(
      db,
      erase(organizationId, table, at.tombstone, keep),
    );
    add(counts, table, 'deleted', n);
    if (xid !== null) horizon = Math.max(horizon, xid + 1);
  }

  const { n: ops } = await inBatches(db, (tx) =>
    counted(
      tx,
      sql`with picked as (
        select op_id from sync_op
         where organization_id = ${organizationId} and applied_at < ${at.syncOp}
         limit ${PURGE_BATCH}
      ), erased as (
        delete from sync_op s using picked
         where s.organization_id = ${organizationId} and s.op_id = picked.op_id
        returning 1
      )
      select count(*)::int as n, null as xid from erased`,
    ),
  );
  add(counts, 'sync_op', 'deleted', ops);

  return { counts, horizonXid: horizon };
}

/**
 * Parcels marked long enough ago, erased with their events in the same
 * transaction: `app.purge` is set for that transaction only, so it never
 * outlives it on a pooled connection.
 */
async function eraseParcelsWithEvents(
  db: AnyDb,
  organizationId: string,
  before: Date,
): Promise<{ n: number; events: number; xid: number | null }> {
  let n = 0;
  let events = 0;
  let xid: number | null = null;
  for (;;) {
    const batch = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.purge', 'on', true)`);
      const [row] = await rowsOf<{
        n: number | string;
        events: number | string;
        xid: string | null;
      }>(
        tx,
        sql`with picked as (
          select t.id from parcel t
           where t.organization_id = ${organizationId}
             and t.deleted_at is not null
             and t.deleted_at < ${before}
           order by t.id
           limit ${PURGE_BATCH}
           for update skip locked
        ), events as (
          delete from event e using picked
           where e.organization_id = ${organizationId}
             and e.entity = 'parcel'
             and e.entity_id = picked.id
          returning 1
        ), erased as (
          delete from parcel using picked where parcel.id = picked.id
          returning parcel.server_xid
        )
        select (select count(*)::int from erased) as n,
               (select count(*)::int from events) as events,
               (select max(server_xid)::text from erased) as xid`,
      );
      return {
        n: Number(row?.n ?? 0),
        events: Number(row?.events ?? 0),
        xid: row?.xid == null ? null : Number(row.xid),
      };
    });
    n += batch.n;
    events += batch.events;
    if (batch.xid !== null) xid = Math.max(xid ?? 0, batch.xid);
    if (batch.n < PURGE_BATCH) return { n, events, xid };
  }
}

export type PurgeOptions = {
  now?: Date;
  /** One mailroom (an admin's "Purger maintenant"), or all of them (the scheduled run). */
  organizationId?: string;
  trigger: PurgeTrigger;
  userId?: string | null;
};

export type PurgeOutcome =
  { status: 'busy' } | { status: 'done'; runs: PurgeRun[] };

async function tryLock(db: AnyDb): Promise<boolean> {
  const [row] = await rowsOf<{ locked: boolean }>(
    db,
    sql`select pg_try_advisory_lock(${LOCK}) as locked`,
  );
  return row?.locked === true;
}

/**
 * Takes the purge lock, then purges each mailroom and records the run. The
 * lock is a session lock: `db` must hold one connection for the whole run
 * (`withConnection`), or the unlock may land on another one. Another run in
 * progress, here or on another instance, answers `busy`.
 */
export async function runPurge(
  db: AnyDb,
  { now = new Date(), organizationId, trigger, userId = null }: PurgeOptions,
): Promise<PurgeOutcome> {
  if (!(await tryLock(db))) return { status: 'busy' };
  try {
    const organizations = organizationId
      ? [organizationId]
      : (await db.select({ id: organization.id }).from(organization)).map(
          (row) => row.id,
        );
    const runs: PurgeRun[] = [];
    for (const id of organizations) {
      const [row] = await db
        .insert(purgeRun)
        .values({ organizationId: id, trigger, userId, startedAt: now })
        .returning({ id: purgeRun.id });
      const { counts, horizonXid } = await purgeOrganization(db, id, now);
      const finishedAt = new Date();
      await db
        .update(purgeRun)
        .set({ finishedAt, counts, horizonXid })
        .where(eq(purgeRun.id, row!.id));
      logger.info(
        { organizationId: id, trigger, counts },
        'retention purge done',
      );
      runs.push({ trigger, startedAt: now, finishedAt, counts });
    }
    return { status: 'done', runs };
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${LOCK})`);
  }
}

/** The last run of this mailroom that went to its end. */
export async function lastPurge(
  db: AnyDb,
  organizationId: string,
): Promise<PurgeRun | null> {
  const [row] = await db
    .select({
      trigger: purgeRun.trigger,
      startedAt: purgeRun.startedAt,
      finishedAt: purgeRun.finishedAt,
      counts: purgeRun.counts,
    })
    .from(purgeRun)
    .where(
      and(
        eq(purgeRun.organizationId, organizationId),
        isNotNull(purgeRun.finishedAt),
      ),
    )
    .orderBy(desc(purgeRun.startedAt))
    .limit(1);
  return row ?? null;
}

/**
 * The cursor a device must hold at least to have pulled every mark the
 * purges of its mailroom erased since.
 */
export async function purgeHorizon(
  db: AnyDb,
  organizationId: string,
): Promise<number> {
  const [row] = await rowsOf<{ horizon: string }>(
    db,
    sql`select coalesce(max(horizon_xid), 0)::text as horizon from purge_run where organization_id = ${organizationId}`,
  );
  return Number(row?.horizon ?? 0);
}
