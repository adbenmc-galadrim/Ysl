import { PURGE_TRIGGERS, type PurgeCounts } from '@repo/contract/retention';
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from '#schema/organization';
import { oneOf } from '#schema/sync';

/**
 * One retention purge of one mailroom (§9.2), scheduled or asked by an admin:
 * the audit trail of what was marked and erased. Not synced. `horizon_xid`
 * is past the last transaction whose deleted rows this run erased: a device
 * whose cursor is below it never pulled some of them, and starts over.
 */
export const purgeRun = pgTable(
  'purge_run',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    trigger: text('trigger', { enum: PURGE_TRIGGERS }).notNull(),
    userId: text('user_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    counts: jsonb('counts').$type<PurgeCounts>().default({}).notNull(),
    horizonXid: bigint('horizon_xid', { mode: 'number' }).default(0).notNull(),
  },
  (table) => [
    oneOf('purge_run_trigger_check', table.trigger, PURGE_TRIGGERS),
    index('purge_run_started_at_idx').on(table.organizationId, table.startedAt),
    index('purge_run_horizon_idx').on(table.organizationId, table.horizonXid),
  ],
);
