import {
  SCAN_REPORT_ERRORS,
  SCAN_REPORT_FIELDS,
  type ScanReportError,
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
  /** Epoch ms: not before; `ABANDONED` once refused for good. */
  nextAttemptAt: number;
  lastError: string | null;
};

/**
 * A report refused for good stays, image freed, with the reason in
 * `lastError`; the next one refused replaces it. For a diagnosis only.
 */
export const ABANDONED = Number.POSITIVE_INFINITY;

/** What became of one report on the way out. */
export type ReportOutcome =
  | 'sent'
  /** The server has no `SCAN_REPORTS_KEY` (404): the feature is off, the report dropped. */
  | 'unavailable'
  /** The server refused it for good (400, 403, 413, 415). */
  | 'refused'
  /** Its image is gone from the phone: nothing was sent. */
  | 'lost'
  /** No session (401): it waits for the next sign-in, no attempt counted. */
  | 'signed-out'
  /** Busy, full, rate limited or offline: it waits for its next attempt. */
  | 'later';

/** An outcome, and the server's `error` when it gave one. */
export type ReportSettled = {
  outcome: ReportOutcome;
  error: ScanReportError | null;
};

export type ReportResponse = {
  status: number;
  retryAfter: string | null;
  /** The `error` of the answer's JSON, when there is one. */
  error?: string | null;
};

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
  await removeImage(files, row);
}

async function removeImage(files: PhotoFiles | null, row: LocalScanReport) {
  if (row.imagePath && files) {
    await files.remove(fileOf(row.imagePath)).catch(() => undefined);
  }
}

/** Keeps the row and its reason, image freed, in place of the former one. */
async function abandon(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  row: LocalScanReport,
  reason: string,
) {
  await db.transaction('rw', db.scanReport, async () => {
    const former = await db.scanReport
      .filter(
        (other) => other.nextAttemptAt === ABANDONED && other.id !== row.id,
      )
      .primaryKeys();
    await db.scanReport.bulkDelete(former);
    await db.scanReport.update(row.id, {
      image: null,
      imagePath: null,
      attempts: row.attempts + 1,
      nextAttemptAt: ABANDONED,
      lastError: reason,
    });
  });
  await removeImage(files, row);
}

const errorOf = (error: string | null | undefined): ScanReportError | null =>
  SCAN_REPORT_ERRORS.find((known) => known === error) ?? null;

/**
 * A file's bytes, in memory: WebKit sends a file read from OPFS as an empty
 * body (Safari on iOS, the server answers 400), so it never goes as is.
 * Null when the file is gone or empty.
 */
export async function inMemory(file: Promise<Blob>, type: string) {
  const bytes = await file.then((read) => read.arrayBuffer()).catch(() => null);
  if (!bytes?.byteLength) return null;
  return new Blob([bytes], { type });
}

async function imageOf(files: PhotoFiles | null, row: LocalScanReport) {
  if (row.image) return row.image;
  if (!row.imagePath || !files) return null;
  return inMemory(files.read(fileOf(row.imagePath)), row.imageType);
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
): Promise<ReportSettled> {
  const image = await imageOf(files, row);
  if (!image) {
    await abandon(db, files, row, 'image missing on the phone');
    return { outcome: 'lost', error: null };
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
    return { outcome: 'later', error: null };
  }
  const { status } = response;
  const error = errorOf(response.error);
  if (status === 200 || status === 201) {
    await drop(db, files, row);
    return { outcome: 'sent', error: null };
  }
  if (status === 404) {
    await drop(db, files, row);
    return { outcome: 'unavailable', error: null };
  }
  if (status === 401) return { outcome: 'signed-out', error };
  if ([400, 403, 413, 415].includes(status)) {
    await abandon(db, files, row, `HTTP ${status}${error ? ` ${error}` : ''}`);
    return { outcome: 'refused', error };
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
  return { outcome: 'later', error };
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
): Promise<ReportSettled[]> {
  const due = (await db.scanReport.orderBy('createdAt').toArray()).filter(
    (row) => row.nextAttemptAt <= now,
  );
  const settled: ReportSettled[] = [];
  for (const row of due) {
    const one = await sendReport(db, files, row, post, now);
    settled.push(one);
    if (one.outcome === 'later' || one.outcome === 'signed-out') break;
  }
  return settled;
}

/** The OPFS files the reports still need: not orphans. */
export async function reportImagePaths(db: CourrierDatabase) {
  const rows = await db.scanReport.toArray();
  return rows.flatMap((row) => (row.imagePath ? [row.imagePath] : []));
}
