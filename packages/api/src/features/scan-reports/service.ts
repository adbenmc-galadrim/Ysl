import { createHash } from 'node:crypto';
import {
  SCAN_REPORT_KEEP_DAYS,
  SCAN_REPORT_PENDING_MAX_BYTES,
  type ScanReportBody,
  type ScanReportDetail,
  type ScanReportImageType,
  type ScanReportSummary,
} from '@repo/contract/scan-report';
import type { AnyDb } from '@repo/db';
import { scanReport } from '@repo/db/schema';
import { asc, eq, lt, sql } from 'drizzle-orm';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** What the image really is, by its bytes and never by what the phone says. */
export function scanImageType(bytes: Buffer): ScanReportImageType | null {
  if (bytes.subarray(0, 8).equals(PNG)) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

export type NewScanReport = {
  id: string;
  userId: string;
  organizationId: string | null;
  report: ScanReportBody;
  comment: string | null;
  image: Buffer;
  now?: Date;
};

export type SaveOutcome = 'created' | 'duplicate' | 'type' | 'full';

/**
 * Keeps a report until the PC fetches it. The phone names it, so an upload
 * resent after a lost answer is the same report, kept once.
 */
export async function saveScanReport(
  db: AnyDb,
  { id, userId, organizationId, report, comment, image, now }: NewScanReport,
): Promise<SaveOutcome> {
  const imageType = scanImageType(image);
  if (!imageType) return 'type';
  const [pending] = await db
    .select({
      bytes: sql<string>`coalesce(sum(${scanReport.imageBytes}), 0)::text`,
    })
    .from(scanReport);
  if (
    Number(pending?.bytes ?? 0) + image.length >
    SCAN_REPORT_PENDING_MAX_BYTES
  ) {
    const [known] = await db
      .select({ id: scanReport.id })
      .from(scanReport)
      .where(eq(scanReport.id, id));
    return known ? 'duplicate' : 'full';
  }
  const inserted = await db
    .insert(scanReport)
    .values({
      id,
      userId,
      organizationId,
      report,
      comment,
      imageType,
      image,
      imageBytes: image.length,
      imageSha256: createHash('sha256').update(image).digest('hex'),
      ...(now ? { createdAt: now } : {}),
    })
    .onConflictDoNothing({ target: scanReport.id })
    .returning({ id: scanReport.id });
  return inserted.length > 0 ? 'created' : 'duplicate';
}

const summary = {
  id: scanReport.id,
  createdAt: scanReport.createdAt,
  imageType: scanReport.imageType,
  imageBytes: scanReport.imageBytes,
};

/** What waits for the PC, oldest first, without images. */
export async function listScanReports(
  db: AnyDb,
  limit = 100,
): Promise<ScanReportSummary[]> {
  const rows = await db
    .select(summary)
    .from(scanReport)
    .orderBy(asc(scanReport.createdAt), asc(scanReport.id))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function scanReportDetail(
  db: AnyDb,
  id: string,
): Promise<ScanReportDetail | null> {
  const [row] = await db
    .select({
      ...summary,
      organizationId: scanReport.organizationId,
      userId: scanReport.userId,
      comment: scanReport.comment,
      imageSha256: scanReport.imageSha256,
      report: scanReport.report,
    })
    .from(scanReport)
    .where(eq(scanReport.id, id));
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function scanReportImage(
  db: AnyDb,
  id: string,
): Promise<{ bytes: Buffer; contentType: ScanReportImageType } | null> {
  const [row] = await db
    .select({ bytes: scanReport.image, contentType: scanReport.imageType })
    .from(scanReport)
    .where(eq(scanReport.id, id));
  return row ?? null;
}

/** The PC wrote it: the report and its image leave the server. */
export async function acknowledgeScanReport(
  db: AnyDb,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(scanReport)
    .where(eq(scanReport.id, id))
    .returning({ id: scanReport.id });
  return deleted.length > 0;
}

/** Nobody fetched them in time: part of the scheduled purge. */
export async function eraseOldScanReports(
  db: AnyDb,
  now: Date,
): Promise<number> {
  const deleted = await db
    .delete(scanReport)
    .where(
      lt(
        scanReport.createdAt,
        sql`${now.toISOString()}::timestamptz - ${`${SCAN_REPORT_KEEP_DAYS} days`}::interval`,
      ),
    )
    .returning({ id: scanReport.id });
  return deleted.length;
}
