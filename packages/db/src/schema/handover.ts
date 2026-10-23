import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { contact, directoryPerson } from '#schema/directory';
import { serverSeqIndex, syncColumns } from '#schema/sync';

export const handoverMethod = pgEnum('handover_method', [
  'qr',
  'pin',
  'signature',
  'manuel',
]);

export const handover = pgTable(
  'handover',
  {
    ...syncColumns(),
    parcelIds: uuid('parcel_ids').array().notNull(),
    personId: uuid('person_id').references(() => directoryPerson.id),
    contactId: uuid('contact_id').references(() => contact.id),
    delegateName: text('delegate_name'),
    method: handoverMethod('method').notNull(),
    // The photo never leaves the device (D8): no server table to reference.
    signaturePhotoId: uuid('signature_photo_id'),
    agentId: text('agent_id')
      .notNull()
      .references(() => user.id),
    at: timestamp('at', { withTimezone: true }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (table) => [
    serverSeqIndex('handover', table.serverSeq),
    index('handover_parcel_ids_idx').using('gin', table.parcelIds),
    check(
      'handover_single_recipient',
      sql`${table.personId} is null or ${table.contactId} is null`,
    ),
  ],
);

export const pickupCode = pgTable(
  'pickup_code',
  {
    ...syncColumns(),
    personId: uuid('person_id').references(() => directoryPerson.id),
    contactId: uuid('contact_id').references(() => contact.id),
    tokenHash: text('token_hash').notNull(),
    pinHash: text('pin_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    serverSeqIndex('pickup_code', table.serverSeq),
    uniqueIndex('pickup_code_token_hash_idx').on(table.tokenHash),
    uniqueIndex('pickup_code_active_person_idx')
      .on(table.personId)
      .where(sql`${table.usedAt} is null and ${table.deletedAt} is null`),
    uniqueIndex('pickup_code_active_contact_idx')
      .on(table.contactId)
      .where(sql`${table.usedAt} is null and ${table.deletedAt} is null`),
    check(
      'pickup_code_single_recipient',
      sql`num_nonnulls(${table.personId}, ${table.contactId}) = 1`,
    ),
  ],
);

export const handoverRelations = relations(handover, ({ one }) => ({
  person: one(directoryPerson, {
    fields: [handover.personId],
    references: [directoryPerson.id],
  }),
  contact: one(contact, {
    fields: [handover.contactId],
    references: [contact.id],
  }),
  agent: one(user, { fields: [handover.agentId], references: [user.id] }),
}));

export const pickupCodeRelations = relations(pickupCode, ({ one }) => ({
  person: one(directoryPerson, {
    fields: [pickupCode.personId],
    references: [directoryPerson.id],
  }),
  contact: one(contact, {
    fields: [pickupCode.contactId],
    references: [contact.id],
  }),
}));
