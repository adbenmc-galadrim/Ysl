import {
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { organization } from '#schema/organization';

export const syncOp = pgTable(
  'sync_op',
  {
    opId: uuid('op_id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    status: smallint('status').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('sync_op_applied_at_idx').on(table.appliedAt)],
);
