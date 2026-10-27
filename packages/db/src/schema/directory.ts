import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
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
    ...syncConstraints('directory_person', table, { referenced: true }),
    oneOf('directory_person_source_check', table.source, DIRECTORY_SOURCES),
    uniqueIndex('directory_person_email_idx')
      .on(table.organizationId, sql`lower(${table.email})`)
      .where(sql`${table.deletedAt} is null`),
    index('directory_person_name_norm_idx')
      .on(table.organizationId, table.nameNorm.op('text_pattern_ops'))
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
    createdBy: text('created_by'),
    usageCount: integer('usage_count').default(0).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    ...syncConstraints('contact', table, { referenced: true }),
    check('contact_usage_count_check', sql`${table.usageCount} >= 0`),
    index('contact_name_norm_idx')
      .on(table.organizationId, table.nameNorm.op('text_pattern_ops'))
      .where(sql`${table.deletedAt} is null`),
    index('contact_last_used_at_idx').on(
      table.organizationId,
      table.lastUsedAt,
    ),
  ],
);

export const recipientAlias = pgTable(
  'recipient_alias',
  {
    ...syncColumns(),
    nameNorm: text('name_norm').notNull(),
    personId: uuid('person_id'),
    contactId: uuid('contact_id'),
    confirmations: integer('confirmations').default(1).notNull(),
  },
  (table) => [
    ...syncConstraints('recipient_alias', table),
    index('recipient_alias_name_norm_idx')
      .on(table.organizationId, table.nameNorm)
      .where(sql`${table.deletedAt} is null`),
    index('recipient_alias_person_id_idx')
      .on(table.personId)
      .where(sql`${table.personId} is not null`),
    index('recipient_alias_contact_id_idx')
      .on(table.contactId)
      .where(sql`${table.contactId} is not null`),
    check(
      'recipient_alias_target_check',
      sql`num_nonnulls(${table.personId}, ${table.contactId}) = 1`,
    ),
    check(
      'recipient_alias_confirmations_check',
      sql`${table.confirmations} >= 1`,
    ),
  ],
);
