import { DAMAGE_REASONS } from '@repo/contract/parcel-damage';
import { REPLY_KINDS } from '@repo/contract/parcel-reply';
import { PARCEL_STATUSES } from '@repo/contract/parcel-status';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { department } from '#schema/department';
import { contact, directoryPerson } from '#schema/directory';
import { sender } from '#schema/sender';
import { oneOf, syncColumns, syncConstraints } from '#schema/sync';

export {
  canTransition,
  PARCEL_STATUSES,
  type ParcelStatus,
} from '@repo/contract/parcel-status';

export const PARCEL_TYPES = ['colis', 'recommande', 'sans_suivi'] as const;

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
    /** Moves one up with every change of status: a step back must carry it (drizzle/0005_statuts_reversibles.sql). */
    statusSeq: integer('status_seq').default(0).notNull(),
    depositedAt: timestamp('deposited_at', { withTimezone: true }),
    carrier: text('carrier'),
    tracking: text('tracking'),
    trackingNorm: text('tracking_norm'),
    personId: uuid('person_id'),
    contactId: uuid('contact_id'),
    readName: text('read_name'),
    notificationEmail: text('notification_email'),
    department: text('department'),
    /** Who sees it (§2.1): follows its person (drizzle/0020), unless chosen at the review (drizzle/0028); null until someone says. */
    departmentId: uuid('department_id'),
    senderId: uuid('sender_id'),
    senderName: text('sender_name'),
    /** Pieces received of a parcel in several boxes, over the pieces its label announces ("2 sur 3"), not the "n" printed on one box. */
    pieceN: integer('piece_n'),
    pieceTotal: integer('piece_total'),
    weightKg: numeric('weight_kg', { precision: 8, scale: 3, mode: 'number' }),
    carrierService: text('carrier_service'),
    reference: text('reference'),
    location: text('location'),
    notes: text('notes'),
    /** The reserve on the parcel's state (YSL-53), see `@repo/contract/parcel-damage`; null when none or lifted. */
    damage: text('damage', { enum: DAMAGE_REASONS }),
    damageNote: text('damage_note'),
    /** Mention the damage in the pickup e-mail. */
    damageNotify: boolean('damage_notify').default(false).notNull(),
    /** A reserve was also made with the carrier, for a claim. */
    damageCarrierReserve: boolean('damage_carrier_reserve')
      .default(false)
      .notNull(),
    damagedAt: timestamp('damaged_at', { withTimezone: true }),
    /** The recipient's last answer to the e-mail as the agent reported it (YSL-70), see `@repo/contract/parcel-reply`. */
    reply: text('reply', { enum: REPLY_KINDS }),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    /** « Un collègue passe le prendre »: the name the handover will offer (YSL-77). */
    expectedDelegate: text('expected_delegate'),
    /** « Absent jusqu'au … »: the last day away, no reminder before the next working day. */
    remindersPausedUntil: timestamp('reminders_paused_until', {
      withTimezone: true,
    }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    receivedBy: text('received_by').notNull(),
    /** The shuttle that took this parcel over; without one, its tour is that of whoever validated it (§3.7.9). Never sent to a device. */
    tourShuttleId: text('tour_shuttle_id'),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    deliveredBy: text('delivered_by'),
  },
  (table) => [
    ...syncConstraints('parcel', table, { referenced: true }),
    foreignKey({
      name: 'parcel_department_fk',
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }),
    index('parcel_department_idx')
      .on(table.organizationId, table.departmentId)
      .where(sql`${table.departmentId} is not null`),
    oneOf('parcel_type_check', table.type, PARCEL_TYPES),
    oneOf('parcel_status_check', table.status, PARCEL_STATUSES),
    check(
      'parcel_single_recipient',
      sql`${table.personId} is null or ${table.contactId} is null`,
    ),
    check(
      'parcel_recipient_check',
      sql`${table.status} not in ('notifie', 'remis') or num_nonnulls(${table.personId}, ${table.contactId}) = 1`,
    ),
    check(
      'parcel_delivery_check',
      sql`(${table.status} = 'remis') = (${table.deliveredAt} is not null and ${table.deliveredBy} is not null)`,
    ),
    check(
      'parcel_pieces_check',
      sql`(${table.pieceN} is null or ${table.pieceN} >= 1) and (${table.pieceTotal} is null or (${table.pieceTotal} >= 1 and (${table.pieceN} is null or ${table.pieceN} <= ${table.pieceTotal})))`,
    ),
    check('parcel_status_seq_check', sql`${table.statusSeq} >= 0`),
    check(
      'parcel_damage_check',
      sql`(${table.damage} is null or ${table.damage} in (${sql.raw(DAMAGE_REASONS.map((reason) => `'${reason}'`).join(', '))})) and (${table.damage} is null) = (${table.damagedAt} is null)`,
    ),
    check(
      'parcel_reply_check',
      sql`(${table.reply} is null or ${table.reply} in (${sql.raw(REPLY_KINDS.map((kind) => `'${kind}'`).join(', '))})) and (${table.reply} is null) = (${table.repliedAt} is null)`,
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
