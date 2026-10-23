import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { serverSeqIndex, syncColumns } from '#schema/sync';

export const directorySource = pgEnum('directory_source', [
  'manuel',
  'csv',
  'entra',
]);

export const directoryPerson = pgTable(
  'directory_person',
  {
    ...syncColumns(),
    lastName: text('last_name').notNull(),
    firstName: text('first_name').notNull(),
    email: text('email').notNull(),
    department: text('department'),
    site: text('site'),
    source: directorySource('source').notNull(),
    active: boolean('active').default(true).notNull(),
  },
  (table) => [
    serverSeqIndex('directory_person', table.serverSeq),
    uniqueIndex('directory_person_email_idx')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const contact = pgTable(
  'contact',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    email: text('email'),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    usageCount: integer('usage_count').default(0).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [serverSeqIndex('contact', table.serverSeq)],
);
