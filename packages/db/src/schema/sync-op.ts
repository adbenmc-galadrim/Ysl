import {
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from '#schema/organization';
import { oneOf } from '#schema/sync';

export const SYNCED_ENTITIES = [
  'directory_person',
  'contact',
  'sender',
  'sender_account',
  'batch',
  'parcel',
  'email_template',
  'notification',
  'pickup_code',
  'handover',
  'event',
  'setting',
] as const;

export const syncOp = pgTable(
  'sync_op',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    opId: uuid('op_id').notNull(),
    userId: text('user_id').notNull(),
    entity: text('entity', { enum: SYNCED_ENTITIES }).notNull(),
    entityId: uuid('entity_id').notNull(),
    status: smallint('status').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.opId] }),
    oneOf('sync_op_entity_check', table.entity, SYNCED_ENTITIES),
    index('sync_op_applied_at_idx').on(table.appliedAt),
  ],
);
