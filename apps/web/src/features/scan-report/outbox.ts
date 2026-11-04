import {
  SCAN_REPORT_FIELDS,
  type ScanReportImageType,
  type ScanReportV1,
} from '@repo/contract/scan-report';
import type { CourrierDatabase } from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';
import { PHOTOS_DIRECTORY } from '#/features/photos/protocol';

/**
 * A scan report waiting to leave (test phase, D32). Its image sits next to
 * the photos in OPFS; where OPFS is missing, in the row itself as a blob.
 * Goes with the feature before the first real users (YSL-148).
 */
export type LocalScanReport = {
  /** The upload's `id`: a resend after a lost answer is the same report. */
  id: string;
  createdAt: Date;
  report: ScanReportV1;
  comment: string | null;
  imageType: ScanReportImageType;
  /** `photos/report-<id>.jpg`; null when the image is in `image`. */
  imagePath: string | null;
  image: Blob | null;
  attempts: number;
  /** Epoch ms: not before. */
  nextAttemptAt: number;
  lastError: string | null;
};

/** What became of one report on the way out. */
export type ReportOutcome =
  | 'sent'
  /** The server has no `SCAN_REPORTS_KEY` (404): the feature is off, the report dropped. */
  | 'unavailable'
  /** The server refused it for good (400, 403, 413, 415), or its image is gone. */
  | 'refused'
  /** No session (401): it waits for the next sign-in, no attempt counted. */
  | 'signed-out'
  /** Busy, full, rate limited or offline: it waits for its next attempt. */
  | 'later';

export type ReportResponse = { status: number; retryAfter: string | null };

/** Posts one upload; throws when the network does. */
export type ReportPost = (body: FormData) => Promise<ReportResponse>;

const BACKOFF_FIRST_MS = 5_000;
const BACKOFF_MAX_MS = 30 * 60_000;

const EXTENSION: Record<ScanReportImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export const reportFileName = (id: string, type: ScanReportImageType) =>
  `report-${id}.${EXTENSION[type]}`;

const fileOf = (path: string) => path.slice(PHOTOS_DIRECTORY.length + 1);

export const backoffAfter = (attempts: number) =>
  Math.min(BACKOFF_FIRST_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);

/** `Retry-After` in seconds or as a date; null when absent or unreadable. */
export function retryAfterMs(header: string | null, now: number) {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

export type NewScanReport = {
  id: string;
  report: ScanReportV1;
  comment: string;
  image: Blob;
  imageType: ScanReportImageType;
};

/**
 * Keeps the report until it leaves. The label's own stored photo is not
 * touched: the image is a copy of the frame the readers had.
 */
export async function enqueueReport(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  input: NewScanReport,
  now = new Date(),
): Promise<LocalScanReport> {
  let imagePath: string | null = null;
  if (files) {
    const name = reportFileName(input.id, input.imageType);
    try {
      await files.save(name, input.image);
      imagePath = `${PHOTOS_DIRECTORY}/${name}`;
    } catch {
      imagePath = null;
    }
  }
  const row: LocalScanReport = {
    id: input.id,
    createdAt: now,
    report: input.report,
    comment: input.comment.trim() === '' ? null : input.comment.trim(),
    imageType: input.imageType,
    imagePath,
    image: imagePath ? null : input.image,
    attempts: 0,
    nextAttemptAt: now.getTime(),
    lastError: null,
  };
  await db.scanReport.put(row);
  return row;
}

async function drop(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  row: LocalScanReport,
) {
  await db.scanReport.delete(row.id);
  if (row.imagePath && files) {
    await files.remove(fileOf(row.imagePath)).catch(() => undefined);
  }
}

async function imageOf(files: PhotoFiles | null, row: LocalScanReport) {
  if (row.image) return row.image;
  if (!row.imagePath || !files) return null;
  return files.read(fileOf(row.imagePath)).catch(() => null);
}

function formOf(row: LocalScanReport, image: Blob): FormData {
  const body = new FormData();
  body.set(SCAN_REPORT_FIELDS.id, row.id);
  body.set(SCAN_REPORT_FIELDS.report, JSON.stringify(row.report));
  if (row.comment) body.set(SCAN_REPORT_FIELDS.comment, row.comment);
  body.set(
    SCAN_REPORT_FIELDS.image,
    image,
    reportFileName(row.id, row.imageType),
  );
  return body;
}

async function postpone(
  db: CourrierDatabase,
  row: LocalScanReport,
  waitMs: number,
  now: number,
  error: string,
) {
  await db.scanReport.update(row.id, {
    attempts: row.attempts + 1,
    nextAttemptAt: now + waitMs,
    lastError: error,
  });
}

/** Sends one report and settles its row as `docs/rapports-scan.md` says. */
export async function sendReport(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  row: LocalScanReport,
  post: ReportPost,
  now = Date.now(),
): Promise<ReportOutcome> {
  const image = await imageOf(files, row);
  if (!image) {
    await drop(db, files, row);
    return 'refused';
  }
  let response: ReportResponse;
  try {
    response = await post(formOf(row, image));
  } catch (error) {
    await postpone(
      db,
      row,
      backoffAfter(row.attempts + 1),
      now,
      error instanceof Error ? error.message : String(error),
    );
    return 'later';
  }
  const { status } = response;
  if (status === 200 || status === 201) {
    await drop(db, files, row);
    return 'sent';
  }
  if (status === 404) {
    await drop(db, files, row);
    return 'unavailable';
  }
  if (status === 401) return 'signed-out';
  if ([400, 403, 413, 415].includes(status)) {
    await drop(db, files, row);
    return 'refused';
  }
  const asked =
    status === 429 || status === 503
      ? retryAfterMs(response.retryAfter, now)
      : null;
  await postpone(
    db,
    row,
    asked ?? backoffAfter(row.attempts + 1),
    now,
    `HTTP ${status}`,
  );
  return 'later';
}

/**
 * Sends every report due, oldest first. Stops at the first one that has to
 * wait: the server is busy, full or out of reach, or the session is gone.
 */
export async function sendDueReports(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  post: ReportPost,
  now = Date.now(),
): Promise<ReportOutcome[]> {
  const due = (await db.scanReport.orderBy('createdAt').toArray()).filter(
    (row) => row.nextAttemptAt <= now,
  );
  const outcomes: ReportOutcome[] = [];
  for (const row of due) {
    const outcome = await sendReport(db, files, row, post, now);
    outcomes.push(outcome);
    if (outcome === 'later' || outcome === 'signed-out') break;
  }
  return outcomes;
}

/** The OPFS files the reports still need: not orphans. */
export async function reportImagePaths(db: CourrierDatabase) {
  const rows = await db.scanReport.toArray();
  return rows.flatMap((row) => (row.imagePath ? [row.imagePath] : []));
}
