import { EMAIL_OUTBOX_STATUSES } from '@repo/contract/mail';
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
  ],
);
