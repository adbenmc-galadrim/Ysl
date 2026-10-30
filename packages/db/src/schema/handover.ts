import {
  HANDOVER_CANCEL_REASONS,
  HANDOVER_METHODS,
} from '@repo/contract/handover';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { contact, directoryPerson } from '#schema/directory';
import { oneOf, syncColumns, syncConstraints } from '#schema/sync';

export const handover = pgTable(
  'handover',
  {
    ...syncColumns(),
    parcelIds: uuid('parcel_ids').array().notNull(),
    personId: uuid('person_id'),
    contactId: uuid('contact_id'),
    recipientName: text('recipient_name').notNull(),
    delegateName: text('delegate_name'),
    method: text('method', { enum: HANDOVER_METHODS }).notNull(),
    agentId: text('agent_id').notNull(),
    /** The agent's name as the iPhone knew it: the journal names them offline. */
    agentName: text('agent_name'),
    at: timestamp('at', { withTimezone: true }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** Why an agent undid it (F44); none when the synchronisation cancelled it. */
    cancelReason: text('cancel_reason', { enum: HANDOVER_CANCEL_REASONS }),
    cancelNote: text('cancel_note'),
    cancelledByName: text('cancelled_by_name'),
    /**
     * A signature or a photo was taken at the handover. The files stay on the
     * iPhone that took them (D8): the server only knows they exist.
     */
    hasSignature: boolean('has_signature').notNull().default(false),
    hasPhoto: boolean('has_photo').notNull().default(false),
  },
  (table) => [
    ...syncConstraints('handover', table),
    oneOf('handover_method_check', table.method, HANDOVER_METHODS),
    check(
      'handover_single_recipient',
      sql`${table.personId} is null or ${table.contactId} is null`,
    ),
    check(
      'handover_recipient_name_check',
      sql`btrim(${table.recipientName}) <> ''`,
    ),
    check('handover_parcels_check', sql`cardinality(${table.parcelIds}) >= 1`),
    check(
      'handover_cancel_check',
      sql`${table.cancelledAt} is null or ${table.cancelledAt} >= ${table.at}`,
    ),
    oneOf(
      'handover_cancel_reason_check',
      table.cancelReason,
      HANDOVER_CANCEL_REASONS,
    ),
    check(
      'handover_cancel_reason_cancelled',
      sql`${table.cancelReason} is null or ${table.cancelledAt} is not null`,
    ),
    index('handover_parcel_ids_idx').using('gin', table.parcelIds),
    index('handover_person_id_idx')
      .on(table.personId)
      .where(sql`${table.personId} is not null`),
    index('handover_contact_id_idx')
      .on(table.contactId)
      .where(sql`${table.contactId} is not null`),
    index('handover_at_idx').on(table.organizationId, table.at),
  ],
);

export const pickupCode = pgTable(
  'pickup_code',
  {
    ...syncColumns(),
    personId: uuid('person_id'),
    contactId: uuid('contact_id'),
    tokenHash: text('token_hash').notNull(),
    pinHash: text('pin_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    ...syncConstraints('pickup_code', table),
    uniqueIndex('pickup_code_token_hash_idx').on(table.tokenHash),
    uniqueIndex('pickup_code_active_person_idx')
      .on(table.personId)
      .where(sql`${table.usedAt} is null and ${table.deletedAt} is null`),
    uniqueIndex('pickup_code_active_contact_idx')
      .on(table.contactId)
      .where(sql`${table.usedAt} is null and ${table.deletedAt} is null`),
    index('pickup_code_person_id_idx')
      .on(table.organizationId, table.personId)
      .where(sql`${table.personId} is not null`),
    index('pickup_code_contact_id_idx')
      .on(table.organizationId, table.contactId)
      .where(sql`${table.contactId} is not null`),
    index('pickup_code_expires_at_idx').on(
      table.organizationId,
      table.expiresAt,
    ),
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
