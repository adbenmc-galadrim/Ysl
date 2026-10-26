import { z } from 'zod';

/** A v1 history of several years stays far below; a wrong file does not. */
export const V1_CSV_MAX_LENGTH = 10_000_000;

export const v1CsvInput = z.object({
  csv: z.string().min(1).max(V1_CSV_MAX_LENGTH),
});

export type V1CsvInput = z.infer<typeof v1CsvInput>;

/** Why a row of the file was imported with a mark (À compléter, note). */
export const IMPORT_FLAGS = [
  'tracking-rejected',
  'tracking-to-verify',
  'status-unknown',
  'recipient-missing',
] as const;

export type ImportFlag = (typeof IMPORT_FLAGS)[number];

/** Why a row of the file was left out. */
export const IMPORT_SKIPS = [
  'tracking-missing',
  'date-invalid',
  'duplicate-in-file',
  'already-present',
] as const;

export type ImportSkip = (typeof IMPORT_SKIPS)[number];

export const TRACKING_FLAGS = [
  'tracking-rejected',
  'tracking-to-verify',
] as const satisfies readonly ImportFlag[];

export function isTrackingFlag(flag: ImportFlag): boolean {
  return (TRACKING_FLAGS as readonly ImportFlag[]).includes(flag);
}

const row = {
  /** The row of the file, the header being row 1. */
  line: z.number().int().min(1),
  tracking: z.string(),
  recipient: z.string().nullable(),
};

export const v1ImportReport = z.object({
  imported: z.number().int().min(0),
  skipped: z.number().int().min(0),
  contactsCreated: z.number().int().min(0),
  flagged: z.array(
    z.object({
      ...row,
      carrier: z.string().nullable(),
      flags: z.array(z.enum(IMPORT_FLAGS)).min(1),
      /** The v1 status as written, when it was not one the v1 knew. */
      status: z.string().optional(),
    }),
  ),
  skips: z.array(z.object({ ...row, reason: z.enum(IMPORT_SKIPS) })),
});

export type V1ImportReport = z.infer<typeof v1ImportReport>;
