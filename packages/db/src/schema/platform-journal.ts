import { JOURNAL_ACTIONS, type JournalDetail } from '@repo/contract/platform';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { oneOf } from '#schema/sync';

/**
 * What the app's admin did, kept twelve months (ME15). Outlives the company and
 * the account it names: hence a name copied at the time, no foreign key, and
 * `company_id` rather than the `organization_id` the deletion's purge looks for.
 */
export const platformJournal = pgTable(
  'platform_journal',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
    action: text('action', { enum: JOURNAL_ACTIONS }).notNull(),
    companyId: uuid('company_id').notNull(),
    companyName: text('company_name').notNull(),
    actorId: text('actor_id').notNull(),
    actorName: text('actor_name').notNull(),
    detail: jsonb('detail').$type<JournalDetail>().default({}).notNull(),
  },
  (table) => [
    oneOf('platform_journal_action_check', table.action, JOURNAL_ACTIONS),
    index('platform_journal_at_idx').on(table.at),
    index('platform_journal_company_idx').on(table.companyId, table.at),
  ],
);
