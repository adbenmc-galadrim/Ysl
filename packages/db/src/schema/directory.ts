import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { oneOf, syncColumns, syncConstraints } from '#schema/sync';

export const DIRECTORY_SOURCES = ['manuel', 'entra'] as const;

export const directoryPerson = pgTable(
  'directory_person',
  {
    ...syncColumns(),
    lastName: text('last_name').notNull(),
    firstName: text('first_name').notNull(),
    nameNorm: text('name_norm').notNull(),
    email: text('email').notNull(),
    department: text('department'),
    site: text('site'),
    source: text('source', { enum: DIRECTORY_SOURCES })
      .default('manuel')
      .notNull(),
    active: boolean('active').default(true).notNull(),
  },
  (table) => [
    ...syncConstraints('directory_person', table),
    oneOf('directory_person_source_check', table.source, DIRECTORY_SOURCES),
    uniqueIndex('directory_person_email_idx')
      .on(table.organizationId, sql`lower(${table.email})`)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const contact = pgTable(
  'contact',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    nameNorm: text('name_norm').notNull(),
    email: text('email'),
    createdBy: text('created_by').references(() => user.id),
    usageCount: integer('usage_count').default(0).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    ...syncConstraints('contact', table),
    check('contact_usage_count_check', sql`${table.usageCount} >= 0`),
  ],
);
