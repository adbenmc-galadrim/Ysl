import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { serverSeqIndex, syncColumns } from '#schema/sync';

export const setting = pgTable(
  'setting',
  {
    ...syncColumns(),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    updatedBy: text('updated_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    serverSeqIndex('setting', table.serverSeq),
    uniqueIndex('setting_key_idx')
      .on(table.key)
      .where(sql`${table.deletedAt} is null`),
  ],
);
