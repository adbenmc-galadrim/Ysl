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
import {
  MAIL_TARGETS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
} from '@repo/contract/mail';
import { contact, directoryPerson } from '#schema/directory';
import { oneOf, syncColumns, syncConstraints } from '#schema/sync';

export { NOTIFICATION_STATUSES, NOTIFICATION_TYPES };

export const emailTemplate = pgTable(
  'email_template',
  {
    ...syncColumns(),
    type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    ownerId: text('owner_id').notNull(),
  },
  (table) => [
    ...syncConstraints('email_template', table, { referenced: true }),
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
    personId: uuid('person_id'),
    contactId: uuid('contact_id'),
    recipients: text('recipients').array().notNull(),
    cc: text('cc')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    parcelIds: uuid('parcel_ids').array().notNull(),
    templateId: uuid('template_id'),
    preparedAt: timestamp('prepared_at', { withTimezone: true }).notNull(),
    preparedBy: text('prepared_by').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    // Declared by the agent (S5): the app only knows it opened the mail app.
    status: text('status', { enum: NOTIFICATION_STATUSES })
      .default('prepared')
      .notNull(),
    target: text('target', { enum: MAIL_TARGETS }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    failedReason: text('failed_reason'),
  },
  (table) => [
    ...syncConstraints('notification', table),
    oneOf('notification_type_check', table.type, NOTIFICATION_TYPES),
    oneOf('notification_status_check', table.status, NOTIFICATION_STATUSES),
    oneOf('notification_target_check', table.target, MAIL_TARGETS),
    check(
      'notification_sent_check',
      sql`(${table.status} = 'sent') = (${table.sentAt} is not null)`,
    ),
    check(
      'notification_failed_check',
      sql`${table.status} = 'failed' or ${table.failedReason} is null`,
    ),
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
