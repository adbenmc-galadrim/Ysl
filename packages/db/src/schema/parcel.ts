import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { contact, directoryPerson } from '#schema/directory';
import { sender } from '#schema/sender';
import { serverSeqIndex, syncColumns } from '#schema/sync';

export const parcelType = pgEnum('parcel_type', [
  'colis',
  'recommande',
  'sans_suivi',
]);

export const parcelStatus = pgEnum('parcel_status', [
  'a_completer',
  'recu',
  'notifie',
  'remis',
  'retourne',
]);

export const batch = pgTable(
  'batch',
  {
    ...syncColumns(),
    agentId: text('agent_id')
      .notNull()
      .references(() => user.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    parcelCount: integer('parcel_count').default(0).notNull(),
  },
  (table) => [serverSeqIndex('batch', table.serverSeq)],
);

export const parcel = pgTable(
  'parcel',
  {
    ...syncColumns(),
    batchId: uuid('batch_id').references(() => batch.id),
    type: parcelType('type').default('colis').notNull(),
    status: parcelStatus('status').notNull(),
    carrier: text('carrier'),
    tracking: text('tracking'),
    trackingNorm: text('tracking_norm'),
    personId: uuid('person_id').references(() => directoryPerson.id),
    contactId: uuid('contact_id').references(() => contact.id),
    readName: text('read_name'),
    notificationEmail: text('notification_email'),
    department: text('department'),
    senderId: uuid('sender_id').references(() => sender.id),
    senderName: text('sender_name'),
    pieceN: integer('piece_n'),
    pieceTotal: integer('piece_total'),
    weightKg: numeric('weight_kg', { precision: 8, scale: 3 }),
    carrierService: text('carrier_service'),
    reference: text('reference'),
    location: text('location'),
    notes: text('notes'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    receivedBy: text('received_by')
      .notNull()
      .references(() => user.id),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    deliveredBy: text('delivered_by').references(() => user.id),
  },
  (table) => [
    serverSeqIndex('parcel', table.serverSeq),
    index('parcel_tracking_norm_idx').on(table.trackingNorm),
    index('parcel_batch_id_idx').on(table.batchId),
    index('parcel_person_id_idx').on(table.personId),
    index('parcel_contact_id_idx').on(table.contactId),
    index('parcel_sender_id_idx').on(table.senderId),
    check(
      'parcel_single_recipient',
      sql`${table.personId} is null or ${table.contactId} is null`,
    ),
  ],
);

export const batchRelations = relations(batch, ({ many }) => ({
  parcels: many(parcel),
}));

export const parcelRelations = relations(parcel, ({ one }) => ({
  batch: one(batch, { fields: [parcel.batchId], references: [batch.id] }),
  person: one(directoryPerson, {
    fields: [parcel.personId],
    references: [directoryPerson.id],
  }),
  contact: one(contact, {
    fields: [parcel.contactId],
    references: [contact.id],
  }),
  sender: one(sender, { fields: [parcel.senderId], references: [sender.id] }),
}));

export const directoryPersonRelations = relations(
  directoryPerson,
  ({ many }) => ({ parcels: many(parcel) }),
);

export const contactRelations = relations(contact, ({ many }) => ({
  parcels: many(parcel),
}));
