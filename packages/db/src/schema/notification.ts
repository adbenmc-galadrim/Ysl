import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { contact, directoryPerson } from '#schema/directory';
import { oneOf, syncColumns, syncConstraints } from '#schema/sync';

export const NOTIFICATION_TYPES = [
  'avis',
  'relance',
  'resume_service',
] as const;

export const emailTemplate = pgTable(
  'email_template',
  {
    ...syncColumns(),
    type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    ...syncConstraints('email_template', table),
    oneOf('email_template_type_check', table.type, NOTIFICATION_TYPES),
    index('email_template_owner_id_idx').on(table.ownerId),
    uniqueIndex('email_template_default_idx')
      .on(table.ownerId, table.type)
      .where(sql`${table.isDefault} and ${table.deletedAt} is null`),
  ],
);

export const notification = pgTable(
  'notification',
  {
    ...syncColumns(),
    type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
    personId: uuid('person_id').references(() => directoryPerson.id, {
      onDelete: 'set null',
    }),
    contactId: uuid('contact_id').references(() => contact.id, {
      onDelete: 'set null',
    }),
    recipients: text('recipients').array().notNull(),
    cc: text('cc')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    parcelIds: uuid('parcel_ids').array().notNull(),
    templateId: uuid('template_id').references(() => emailTemplate.id, {
      onDelete: 'set null',
    }),
    preparedAt: timestamp('prepared_at', { withTimezone: true }).notNull(),
    preparedBy: text('prepared_by')
      .notNull()
      .references(() => user.id),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [
    ...syncConstraints('notification', table),
    oneOf('notification_type_check', table.type, NOTIFICATION_TYPES),
    check(
      'notification_single_recipient',
      sql`${table.personId} is null or ${table.contactId} is null`,
    ),
    check(
      'notification_parcels_check',
      sql`cardinality(${table.parcelIds}) >= 1`,
    ),
    check(
      'notification_recipients_check',
      sql`cardinality(${table.recipients}) >= 1`,
    ),
    index('notification_parcel_ids_idx').using('gin', table.parcelIds),
    index('notification_person_id_idx')
      .on(table.personId)
      .where(sql`${table.personId} is not null`),
    index('notification_contact_id_idx')
      .on(table.contactId)
      .where(sql`${table.contactId} is not null`),
    index('notification_template_id_idx')
      .on(table.templateId)
      .where(sql`${table.templateId} is not null`),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  template: one(emailTemplate, {
    fields: [notification.templateId],
    references: [emailTemplate.id],
  }),
  person: one(directoryPerson, {
    fields: [notification.personId],
    references: [directoryPerson.id],
  }),
  contact: one(contact, {
    fields: [notification.contactId],
    references: [contact.id],
  }),
}));
