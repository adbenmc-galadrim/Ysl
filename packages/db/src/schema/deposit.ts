import { DEPOSIT_GAPS } from '@repo/contract/deposits';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { department } from '#schema/department';
import { oneOf, syncColumns, syncConstraints } from '#schema/sync';

/**
 * Parcels put down at a department, as the shuttle announced them, and what the
 * department counted (D24). The tour itself stays read from the parcels (§3.7.9).
 */
export const deposit = pgTable(
  'deposit',
  {
    ...syncColumns(),
    departmentId: uuid('department_id').notNull(),
    shuttleId: text('shuttle_id').notNull(),
    shuttleName: text('shuttle_name'),
    parcelIds: uuid('parcel_ids').array().notNull(),
    announced: integer('announced').notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
    counted: integer('counted'),
    gap: text('gap', { enum: DEPOSIT_GAPS }),
    gapParcelIds: uuid('gap_parcel_ids').array(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmedBy: text('confirmed_by'),
    confirmedByName: text('confirmed_by_name'),
  },
  (table) => [
    ...syncConstraints('deposit', table),
    foreignKey({
      name: 'deposit_department_fk',
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }),
    oneOf('deposit_gap_check', table.gap, DEPOSIT_GAPS),
    check(
      'deposit_confirmed_check',
      sql`(${table.confirmedAt} is null) = (${table.counted} is null)`,
    ),
    index('deposit_department_idx').on(
      table.organizationId,
      table.departmentId,
    ),
    index('deposit_shuttle_idx').on(table.organizationId, table.shuttleId),
  ],
);
