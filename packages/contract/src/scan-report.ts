import { z } from 'zod';

/**
 * A scan report of the test phase (D32): the whole label photo and every
 * reading, sent by a signed-in account, kept on the server until Adam's PC
 * fetches it, then deleted. Withdrawn before the first real users (YSL-148).
 */

export const SCAN_REPORT_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;

export type ScanReportImageType = (typeof SCAN_REPORT_IMAGE_TYPES)[number];

/** A full 4032 × 3024 JPEG from the iPhone fits with room to spare. */
export const SCAN_REPORT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** The readings, as JSON text. */
export const SCAN_REPORT_JSON_MAX_BYTES = 512 * 1024;

export const SCAN_REPORT_COMMENT_MAX_LENGTH = 2000;

/** The whole upload, form boundaries included: refused before it is read. */
export const SCAN_REPORT_BODY_MAX_BYTES =
  SCAN_REPORT_IMAGE_MAX_BYTES + SCAN_REPORT_JSON_MAX_BYTES + 64 * 1024;

/** Nobody fetched it by then: the purge deletes it. */
export const SCAN_REPORT_KEEP_DAYS = 14;

/** What waits on the server, images summed: past it, uploads are refused. */
export const SCAN_REPORT_PENDING_MAX_BYTES = 1024 * 1024 * 1024;

/** Uploads per account in a sliding window. */
export const SCAN_REPORT_RATE = { max: 20, windowMs: 10 * 60_000 } as const;

/** Uploads read at once, all accounts together: each holds its image in memory. */
export const SCAN_REPORT_UPLOADS_AT_ONCE = 2;

/** The parts of the `multipart/form-data` upload. */
export const SCAN_REPORT_FIELDS = {
  /** A UUID chosen by the phone: a resent upload is the same report. */
  id: 'id',
  /** The readings, a JSON object. */
  report: 'report',
  comment: 'comment',
  image: 'image',
} as const;

/** The `error` of a refused upload; `docs/rapports-scan.md` says what the outbox does with each. */
export const SCAN_REPORT_ERRORS = [
  'invalid',
  'too_large',
  'type',
  'unauthorized',
  'suspended',
  'rate_limited',
  'busy',
  'full',
] as const;

export type ScanReportError = (typeof SCAN_REPORT_ERRORS)[number];

/** The body of a kept upload (201, or 200 when it was already there). */
export type ScanReportUploaded = { id: string };

export const scanReportId = z.uuid();

export const scanReportBody = z.record(z.string(), z.unknown());

export type ScanReportBody = z.infer<typeof scanReportBody>;

/** One line of the PC's list: no image, no readings. */
export type ScanReportSummary = {
  id: string;
  createdAt: string;
  imageType: ScanReportImageType;
  imageBytes: number;
};

/** What the PC downloads, the image apart. */
export type ScanReportDetail = ScanReportSummary & {
  organizationId: string | null;
  userId: string;
  comment: string | null;
  /** SHA-256 of the image, hex: the PC checks what it wrote before acknowledging. */
  imageSha256: string;
  report: ScanReportBody;
};
