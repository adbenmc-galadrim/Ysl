import { type DnsRecord, MAIL_DOMAIN_STATUSES } from '@repo/contract/mail';
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from '#schema/organization';
import { oneOf } from '#schema/sync';

/**
 * The address a company's e-mails leave from. Not synced: only the server may
 * say a domain is verified. All companies share one provider account, so a
 * domain belongs to one company at most.
 */
export const mailSender = pgTable(
  'mail_sender',
  {
    organizationId: uuid('organization_id')
      .primaryKey()
      .references(() => organization.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    domain: text('domain').notNull(),
    status: text('status', { enum: MAIL_DOMAIN_STATUSES })
      .default('pending')
      .notNull(),
    dnsRecords: jsonb('dns_records').$type<DnsRecord[]>().default([]).notNull(),
    // This company declared the domain at the provider, rather than finding it there.
    declared: boolean('declared').default(false).notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    updatedBy: text('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    oneOf('mail_sender_status_check', table.status, MAIL_DOMAIN_STATUSES),
    uniqueIndex('mail_sender_domain_idx').on(table.domain),
  ],
);
