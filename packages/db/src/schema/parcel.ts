import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { contact, directoryPerson } from '#schema/directory';
import { sender } from '#schema/sender';
import { oneOf, syncColumns, syncConstraints } from '#schema/sync';

export const PARCEL_TYPES = ['colis', 'recommande', 'sans_suivi'] as const;

export const PARCEL_STATUSES = [
  'a_completer',
  'recu',
  'notifie',
  'remis',
  'retourne',
] as const;

export const batch = pgTable(
  'batch',
  {
    ...syncColumns(),
    agentId: text('agent_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    parcelCount: integer('parcel_count').default(0).notNull(),
  },
  (table) => [
    ...syncConstraints('batch', table, { referenced: true }),
    check('batch_parcel_count_check', sql`${table.parcelCount} >= 0`),
    check(
      'batch_period_check',
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const parcel = pgTable(
  'parcel',
  {
    ...syncColumns(),
    batchId: uuid('batch_id'),
    type: text('type', { enum: PARCEL_TYPES }).default('colis').notNull(),
    status: text('status', { enum: PARCEL_STATUSES }).notNull(),
    carrier: text('carrier'),
    tracking: text('tracking'),
    trackingNorm: text('tracking_norm'),
    personId: uuid('person_id'),
    contactId: uuid('contact_id'),
    readName: text('read_name'),
    notificationEmail: text('notification_email'),
    department: text('department'),
    senderId: uuid('sender_id'),
    senderName: text('sender_name'),
    pieceN: integer('piece_n'),
    pieceTotal: integer('piece_total'),
    weightKg: numeric('weight_kg', { precision: 8, scale: 3, mode: 'number' }),
    carrierService: text('carrier_service'),
    reference: text('reference'),
    location: text('location'),
    notes: text('notes'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    receivedBy: text('received_by').notNull(),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    deliveredBy: text('delivered_by'),
  },
  (table) => [
    ...syncConstraints('parcel', table, { referenced: true }),
    oneOf('parcel_type_check', table.type, PARCEL_TYPES),
    oneOf('parcel_status_check', table.status, PARCEL_STATUSES),
    check(
      'parcel_single_recipient',
      sql`${table.personId} is null or ${table.contactId} is null`,
    ),
    check(
      'parcel_delivery_check',
      sql`(${table.status} = 'remis') = (${table.deliveredAt} is not null and ${table.deliveredBy} is not null)`,
    ),
    check(
      'parcel_pieces_check',
      sql`(${table.pieceN} is null or ${table.pieceN} >= 1) and (${table.pieceTotal} is null or (${table.pieceTotal} >= 1 and (${table.pieceN} is null or ${table.pieceN} <= ${table.pieceTotal})))`,
    ),
    check(
      'parcel_weight_check',
      sql`${table.weightKg} is null or ${table.weightKg} >= 0`,
    ),
    index('parcel_tracking_norm_idx')
      .on(table.organizationId, table.trackingNorm)
      .where(sql`${table.trackingNorm} is not null`),
    index('parcel_open_status_idx')
      .on(table.organizationId, table.status, table.receivedAt)
      .where(
        sql`${table.deletedAt} is null and ${table.status} in ('a_completer', 'recu', 'notifie')`,
      ),
    index('parcel_overdue_idx')
      .on(
        table.organizationId,
        sql`coalesce(${table.lastNotifiedAt}, ${table.notifiedAt})`,
      )
      .where(sql`${table.deletedAt} is null and ${table.status} = 'notifie'`),
    index('parcel_batch_id_idx')
      .on(table.batchId)
      .where(sql`${table.batchId} is not null`),
    index('parcel_person_id_idx')
      .on(table.personId)
      .where(sql`${table.personId} is not null`),
    index('parcel_contact_id_idx')
      .on(table.contactId)
      .where(sql`${table.contactId} is not null`),
    index('parcel_sender_id_idx')
      .on(table.senderId)
      .where(sql`${table.senderId} is not null`),
    index('parcel_delivered_at_idx')
      .on(table.organizationId, table.deliveredAt)
      .where(sql`${table.deliveredAt} is not null`),
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
