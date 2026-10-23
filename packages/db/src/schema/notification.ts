import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { contact, directoryPerson } from '#schema/directory';
import { serverSeqIndex, syncColumns } from '#schema/sync';

export const notificationType = pgEnum('notification_type', [
  'avis',
  'relance',
  'resume_service',
]);

export const emailTemplate = pgTable(
  'email_template',
  {
    ...syncColumns(),
    type: notificationType('type').notNull(),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    serverSeqIndex('email_template', table.serverSeq),
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
    type: notificationType('type').notNull(),
    personId: uuid('person_id').references(() => directoryPerson.id),
    contactId: uuid('contact_id').references(() => contact.id),
    recipients: text('recipients').array().notNull(),
    cc: text('cc')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    parcelIds: uuid('parcel_ids').array().notNull(),
    templateId: uuid('template_id').references(() => emailTemplate.id),
    preparedAt: timestamp('prepared_at', { withTimezone: true }).notNull(),
    preparedBy: text('prepared_by')
      .notNull()
      .references(() => user.id),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [
    serverSeqIndex('notification', table.serverSeq),
    index('notification_parcel_ids_idx').using('gin', table.parcelIds),
    check(
      'notification_single_recipient',
      sql`${table.personId} is null or ${table.contactId} is null`,
    ),
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
