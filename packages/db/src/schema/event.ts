import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { syncColumns, syncConstraints } from '#schema/sync';

export const event = pgTable(
  'event',
  {
    ...syncColumns(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    type: text('type').notNull(),
    actorId: text('actor_id').references(() => user.id),
    at: timestamp('at', { withTimezone: true }).notNull(),
    detail: jsonb('detail'),
  },
  (table) => [
    ...syncConstraints('event', table),
    index('event_entity_id_idx').on(table.entityId, table.at),
    index('event_at_idx').on(table.at),
  ],
);
