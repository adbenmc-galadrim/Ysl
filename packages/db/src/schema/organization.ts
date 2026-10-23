import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const organizationMember = pgTable('organization_member', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organization.id),
});
