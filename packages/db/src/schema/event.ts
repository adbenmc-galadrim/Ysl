import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { serverSeqIndex, syncColumns } from '#schema/sync';

export const event = pgTable(
  'event',
  {
    ...syncColumns(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    type: text('type').notNull(),
    actorId: text('actor_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    at: timestamp('at', { withTimezone: true }).notNull(),
    detail: jsonb('detail'),
  },
  (table) => [
    serverSeqIndex('event', table.serverSeq),
    index('event_entity_idx').on(table.entity, table.entityId),
  ],
);
