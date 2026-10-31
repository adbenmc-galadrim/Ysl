import { PROFILE_MODELS } from '@repo/contract/operating-profile';
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  // No connection and no synchronisation while set; everything is kept (ME13).
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  // Last time it came back: a phone whose session ran out before then keeps its proofs.
  reactivatedAt: timestamp('reactivated_at', { withTimezone: true }),
  // The model picked at creation (D30), for the record: the company's profile lives on, in `setting`.
  profileModel: text('profile_model', { enum: PROFILE_MODELS }),
});

export const organizationMember = pgTable(
  'organization_member',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
  },
  (table) => [
    uniqueIndex('organization_member_organization_user_idx').on(
      table.organizationId,
      table.userId,
    ),
  ],
);
