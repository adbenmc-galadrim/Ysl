import { sql } from 'drizzle-orm';
import {
  bigint,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '#schema/auth';
import { organizationMember } from '#schema/organization';
import { syncColumns, syncConstraints } from '#schema/sync';

export const department = pgTable(
  'department',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    receptionPoint: text('reception_point'),
    pickup: jsonb('pickup'),
    /** The address answers go to (mockup 16): a shared box, not a person's. */
    replyEmail: text('reply_email'),
    /** The last transaction that took a row out of this department: a device behind it reads everything again. */
    scopeXid: bigint('scope_xid', { mode: 'number' }),
  },
  (table) => [
    ...syncConstraints('department', table, { referenced: true }),
    uniqueIndex('department_name_idx')
      .on(table.organizationId, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const departmentMember = pgTable(
  'department_member',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull(),
    departmentId: uuid('department_id').notNull(),
  },
  (table) => [
    index('department_member_department_idx').on(table.departmentId),
    foreignKey({
      name: 'department_member_department_fk',
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }),
    foreignKey({
      name: 'department_member_organization_member_fk',
      columns: [table.organizationId, table.userId],
      foreignColumns: [
        organizationMember.organizationId,
        organizationMember.userId,
      ],
    }).onDelete('cascade'),
  ],
);
