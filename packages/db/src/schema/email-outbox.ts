import { DELIVERY_STATUSES, EMAIL_OUTBOX_STATUSES } from '@repo/contract/mail';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { notification } from '#schema/notification';
import { organization } from '#schema/organization';
import { oneOf } from '#schema/sync';

/**
 * The server's e-mails on their way out. Not synced. A row is
 * one message: `idempotency_key` keeps a retried caller from queueing it twice.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    idempotencyKey: text('idempotency_key').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id),
    // The notification this mail carries, when it has one: its status follows.
    notificationId: uuid('notification_id').references(() => notification.id, {
      onDelete: 'set null',
    }),
    recipient: text('recipient').notNull(),
    recipientName: text('recipient_name'),
    subject: text('subject').notNull(),
    textBody: text('text_body').notNull(),
    htmlBody: text('html_body'),
    status: text('status', { enum: EMAIL_OUTBOX_STATUSES })
      .default('queued')
      .notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    providerMessageId: text('provider_message_id'),
    deliveryStatus: text('delivery_status', { enum: DELIVERY_STATUSES }),
    deliveryAt: timestamp('delivery_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    oneOf('email_outbox_status_check', table.status, EMAIL_OUTBOX_STATUSES),
    uniqueIndex('email_outbox_idempotency_key_idx').on(table.idempotencyKey),
    index('email_outbox_due_idx').on(table.status, table.nextAttemptAt),
    index('email_outbox_finished_at_idx').on(table.finishedAt),
    oneOf(
      'email_outbox_delivery_status_check',
      table.deliveryStatus,
      DELIVERY_STATUSES,
    ),
    index('email_outbox_provider_message_id_idx')
      .on(table.providerMessageId)
      .where(sql`${table.providerMessageId} is not null`),
    index('email_outbox_notification_id_idx')
      .on(table.notificationId)
      .where(sql`${table.notificationId} is not null`),
  ],
);
