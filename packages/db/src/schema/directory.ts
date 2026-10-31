import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { department } from '#schema/department';
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
    /** The department that holds this person; the text above goes with the conversion (YSL-118). */
    departmentId: uuid('department_id'),
    site: text('site'),
    source: text('source', { enum: DIRECTORY_SOURCES })
      .default('manuel')
      .notNull(),
    active: boolean('active').default(true).notNull(),
  },
  (table) => [
    ...syncConstraints('directory_person', table, { referenced: true }),
    foreignKey({
      name: 'directory_person_department_fk',
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }),
    index('directory_person_department_idx')
      .on(table.organizationId, table.departmentId)
      .where(sql`${table.departmentId} is not null`),
    oneOf('directory_person_source_check', table.source, DIRECTORY_SOURCES),
    uniqueIndex('directory_person_email_idx')
      .on(
        table.organizationId,
        sql`coalesce(${table.departmentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        sql`lower(${table.email})`,
      )
      .where(sql`${table.deletedAt} is null`),
    index('directory_person_name_norm_idx')
      .on(table.organizationId, table.nameNorm.op('text_pattern_ops'))
      .where(sql`${table.deletedAt} is null`),
  ],
);

/**
 * A department asking the company admin to move one of its people (ME21, ME22):
 * it moves nobody itself. One open request per person, closed by the trigger
 * of drizzle/0022 once that person leaves the department, however they moved.
 */
export const directoryMoveRequest = pgTable(
  'directory_move_request',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    personId: uuid('person_id').notNull(),
    departmentId: uuid('department_id').notNull(),
    requestedBy: text('requested_by'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'directory_move_request_person_fk',
      columns: [table.organizationId, table.personId],
      foreignColumns: [directoryPerson.organizationId, directoryPerson.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'directory_move_request_department_fk',
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }),
    uniqueIndex('directory_move_request_open_idx')
      .on(table.organizationId, table.personId)
      .where(sql`${table.closedAt} is null`),
  ],
);

export const contact = pgTable(
  'contact',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    nameNorm: text('name_norm').notNull(),
    email: text('email'),
    department: text('department'),
    createdBy: text('created_by'),
    usageCount: integer('usage_count').default(0).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    // Who was told for them last time (`person:<id>` or `contact:<id>`), offered first next time.
    notifyVia: text('notify_via'),
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
