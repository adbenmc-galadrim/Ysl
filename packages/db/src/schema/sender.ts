import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { syncColumns, syncConstraints } from '#schema/sync';

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
    ...syncConstraints('sender', table, { referenced: true }),
    index('sender_name_norm_idx')
      .on(table.organizationId, table.nameNorm.op('text_pattern_ops'))
      .where(sql`${table.deletedAt} is null`),
    check('sender_seen_count_check', sql`${table.seenCount} >= 0`),
  ],
);

export const senderAccount = pgTable(
  'sender_account',
  {
    ...syncColumns(),
    carrier: text('carrier').notNull(),
    accountNumber: text('account_number').notNull(),
    senderId: uuid('sender_id').notNull(),
    confirmations: integer('confirmations').default(0).notNull(),
  },
  (table) => [
    ...syncConstraints('sender_account', table),
    uniqueIndex('sender_account_carrier_number_idx')
      .on(
        table.organizationId,
        sql`lower(${table.carrier})`,
        sql`upper(regexp_replace(${table.accountNumber}, '[[:space:]]', '', 'g'))`,
      )
      .where(sql`${table.deletedAt} is null`),
    index('sender_account_sender_id_idx').on(table.senderId),
    check(
      'sender_account_confirmations_check',
      sql`${table.confirmations} >= 0`,
    ),
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
