import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { serverSeqIndex, syncColumns } from '#schema/sync';

export const sender = pgTable(
  'sender',
  {
    ...syncColumns(),
    displayName: text('display_name').notNull(),
    nameNorm: text('name_norm').notNull(),
    address: text('address'),
    seenCount: integer('seen_count').default(0).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => [
    serverSeqIndex('sender', table.serverSeq),
    index('sender_name_norm_idx').on(table.nameNorm),
  ],
);

export const senderAccount = pgTable(
  'sender_account',
  {
    ...syncColumns(),
    carrier: text('carrier').notNull(),
    accountNumber: text('account_number').notNull(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => sender.id),
    confirmations: integer('confirmations').default(0).notNull(),
  },
  (table) => [
    serverSeqIndex('sender_account', table.serverSeq),
    uniqueIndex('sender_account_carrier_number_idx')
      .on(table.carrier, table.accountNumber)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const senderRelations = relations(sender, ({ many }) => ({
  accounts: many(senderAccount),
}));

export const senderAccountRelations = relations(senderAccount, ({ one }) => ({
  sender: one(sender, {
    fields: [senderAccount.senderId],
    references: [sender.id],
  }),
}));
