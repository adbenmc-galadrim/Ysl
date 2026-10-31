import { LOGO_TYPES } from '@repo/contract/company-settings';
import { sql } from 'drizzle-orm';
import {
  customType,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from '#schema/organization';
import { oneOf } from '#schema/sync';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * A company's logo (D28), kept in the database: no other service to run. Not
 * synced. A new upload is a new `id`, so the public URL can be cached for good
 * and says nothing of the company. It goes with its company.
 */
export const companyLogo = pgTable(
  'company_logo',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    contentType: text('content_type', { enum: LOGO_TYPES }).notNull(),
    bytes: bytea('bytes').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    oneOf('company_logo_content_type_check', table.contentType, LOGO_TYPES),
    uniqueIndex('company_logo_organization_idx').on(table.organizationId),
  ],
);
