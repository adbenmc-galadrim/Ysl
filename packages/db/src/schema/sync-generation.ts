import { sql } from 'drizzle-orm';
import { check, pgTable, smallint, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The generation every sync cursor belongs to. A restore (pg_dump, PITR, new
 * host) can set the transaction counter back below the cursors the devices
 * hold; bumping the generation makes every device start over instead of
 * pulling nothing forever. One row, updated by the restore runbook.
 */
export const syncGeneration = pgTable(
  'sync_generation',
  {
    id: smallint('id').primaryKey().default(1),
    generation: uuid('generation')
      .default(sql`gen_random_uuid()`)
      .notNull(),
    restoredAt: timestamp('restored_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [check('sync_generation_single_row', sql`${table.id} = 1`)],
);
