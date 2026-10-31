import {
  DELIVERY_STATUSES,
  EMAIL_OUTBOX_STATUSES,
  SUPPRESSION_REASONS,
} from '@repo/contract/mail';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { notification } from '#schema/notification';
import { organization } from '#schema/organization';
import { oneOf } from '#schema/sync';

export type EmailAttachment = { name: string; contentBase64: string };

/**
 * The server's e-mails on their way out. Not synced. A row is
 * one message: `idempotency_key` keeps a retried caller from queueing it twice.
 * A pickup code stays in clear only while the mail waits: the text goes once
 * the row is finished, the address stays for the follow-up.
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
    replyTo: text('reply_to'),
    attachments: jsonb('attachments').$type<EmailAttachment[]>(),
    // The code this mail quotes, and the one it took over from: given back if it fails.
    pickupCodeId: uuid('pickup_code_id'),
    replacedCodeId: uuid('replaced_code_id'),
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

/** An address that asked for no more mail (ME02), past the 30 days of the queue. */
export const emailSuppression = pgTable(
  'email_suppression',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    email: text('email').notNull(),
    reason: text('reason', { enum: SUPPRESSION_REASONS }).notNull(),
    at: timestamp('at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.email] }),
    oneOf('email_suppression_reason_check', table.reason, SUPPRESSION_REASONS),
  ],
);
