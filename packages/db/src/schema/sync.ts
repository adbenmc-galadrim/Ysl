import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  pgSequence,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const syncSeq = pgSequence('sync_seq');

export function syncColumns() {
  return {
    id: uuid('id').primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    // Overwritten on every insert and update by the bump_server_seq trigger
    // (drizzle/0002_curseur_sync.sql): a new synced table needs its own trigger.
    serverSeq: bigint('server_seq', { mode: 'number' })
      .default(sql`nextval('sync_seq')`)
      .notNull(),
  };
}

export function serverSeqIndex(table: string, serverSeq: AnyPgColumn) {
  return index(`${table}_server_seq_idx`).on(serverSeq);
}
