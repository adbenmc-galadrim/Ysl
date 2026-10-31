import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { organization } from '#schema/organization';

/**
 * The last link given for an account: one row each, a new link replaces the
 * old. Only the token's hash is here. Goes with its account and its company.
 */
export const accountInvitation = pgTable(
  'account_invitation',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('account_invitation_user_idx').on(table.userId),
    uniqueIndex('account_invitation_token_idx').on(table.tokenHash),
  ],
);
