import {
  SCAN_REPORT_IMAGE_TYPES,
  type ScanReportBody,
} from '@repo/contract/scan-report';
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { oneOf } from '#schema/sync';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * A scan report of the test phase (D32), waiting for Adam's PC, which deletes
 * it once fetched; the purge takes it after 14 days. Apart from the business
 * tables: no foreign key either way, so dropping it (YSL-148) touches nothing
 * else, and `organization_id` lets a company's deletion take its reports.
 * Not synced, and no admin screen reads it (D26).
 */
export const scanReport = pgTable(
  'scan_report',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id'),
    userId: text('user_id').notNull(),
    report: jsonb('report').$type<ScanReportBody>().notNull(),
    comment: text('comment'),
    imageType: text('image_type', { enum: SCAN_REPORT_IMAGE_TYPES }).notNull(),
    image: bytea('image').notNull(),
    imageBytes: integer('image_bytes').notNull(),
    imageSha256: text('image_sha256').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    oneOf(
      'scan_report_image_type_check',
      table.imageType,
      SCAN_REPORT_IMAGE_TYPES,
    ),
    index('scan_report_created_idx').on(table.createdAt),
  ],
);
