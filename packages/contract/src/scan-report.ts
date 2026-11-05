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

/**
 * The shape of `report` the phone sends (YSL-143). The server only checks
 * it is an object; the PC writes it as received and the agent replays the
 * image in the bench with it (YSL-147). A change of shape bumps the version;
 * YSL-151 only widened it (optional fields, `shot` nullable, new states), so
 * every report sent before still reads.
 */
export const SCAN_REPORT_VERSION = 1;

const size = { width: z.number(), height: z.number() };

const point = z.object({ x: z.number(), y: z.number() });

/** A symbol as zxing read it, its corners in the pixels of its pass (`width` × `height`). */
export const scanReportSymbol = z.object({
  format: z.string(),
  text: z.string(),
  isValid: z.boolean(),
  position: z.object({
    topLeft: point,
    topRight: point,
    bottomRight: point,
    bottomLeft: point,
  }),
  orientation: z.number(),
});

/** One pass of the cascade: the first on the whole frame, a second for the formats the carrier still owes. */
export const scanReportDecodePass = z.object({
  /** The formats the second pass looked for; null on the first. */
  expect: z.array(z.string()).nullable(),
  symbols: z.array(scanReportSymbol),
  steps: z.array(
    z.object({
      name: z.string(),
      ms: z.number(),
      symbols: z.number(),
      ...size,
    }),
  ),
  ...size,
  totalMs: z.number(),
});

export const scanReportOcrLine = z.object({
  text: z.string(),
  box: z.object({ x: z.number(), y: z.number(), ...size }),
  score: z.number(),
});

/**
 * The text, read on the stored photo (the image sent, shrunk to `maxSide`
 * and saved as JPEG at `quality`): its boxes are in the frame of the
 * engine's image (`width` × `height`), itself from `sourceWidth` × `sourceHeight`.
 */
export const scanReportOcr = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('done'),
    engine: z.string(),
    ...size,
    sourceWidth: z.number(),
    sourceHeight: z.number(),
    input: z.object({ maxSide: z.number(), quality: z.number() }),
    timings: z.record(z.string(), z.number()),
    lines: z.array(scanReportOcrLine),
  }),
  /**
   * `skipped`: models not on the device yet; `failed`: the engine failed;
   * `pending`: still reading 15 s after « Envoyer »; `none`: no text read
   * for this shot (a piece joined to its parcel, a duplicate outside the batch);
   * `kept`: sent away from the scan screen, what the phone kept is in `kept`.
   */
  z.object({ state: z.enum(['skipped', 'failed', 'pending', 'none', 'kept']) }),
]);

const fieldSource = z.object({
  kind: z.string(),
  format: z.string(),
  confidence: z.number(),
  value: z.string(),
});

/** A field as the reader scored it (`@repo/contract/extract`). */
export const scanReportField = z.object({
  value: z.unknown(),
  confidence: z.number(),
  level: z.enum(['sure', 'to-verify', 'none']),
  flags: z.array(z.string()),
  sources: z.array(fieldSource),
  candidates: z.array(z.unknown()).optional(),
});

/** What the user set by hand before the report left, in the batch review too. */
export const scanReportCorrection = z.object({
  field: z.enum([
    'tracking',
    'recipient',
    'sender',
    'type',
    'department',
    'carrier',
    'pieces',
    'weightKg',
    'service',
    'reference',
  ]),
  value: z.string().nullable(),
  how: z.enum(['typed', 'chosen', 'confirmed']),
});

/** The screen the report was sent from; absent on reports sent before YSL-151: the scan. */
export const SCAN_REPORT_ORIGINS = ['scan', 'revue', 'lecture'] as const;

export type ScanReportOrigin = (typeof SCAN_REPORT_ORIGINS)[number];

/**
 * What a report sent away from the scan screen lacks, the frame being gone:
 * `frame`, the image is the stored 1 600 px photo; `shot`, the viewfinder's
 * settings; `decodePasses`, zxing's passes (positions, steps, times);
 * `ocrBoxes`, the OCR lines with their boxes and scores; `ocr`, any text;
 * `extraction`, the fusion before corrections; `draft`, the batch's draft.
 */
export const SCAN_REPORT_MISSING = [
  'frame',
  'shot',
  'decodePasses',
  'ocrBoxes',
  'ocr',
  'extraction',
  'draft',
] as const;

export type ScanReportMissing = (typeof SCAN_REPORT_MISSING)[number];

/**
 * The readings the phone kept for the parcel, as they were saved: a draft
 * of the batch (`ocrLines` in the frame of the stored photo) or a parcel
 * past « Terminer » (`ocrText` only).
 */
export const scanReportKept = z.object({
  from: z.enum(['draft', 'stored']),
  /** When the reading was saved, ISO. */
  readAt: z.iso.datetime(),
  /** The rules that scored the fields; null on a draft, scored on the spot. */
  rules: z.number().nullable(),
  codes: z.array(z.object({ format: z.string(), text: z.string() })),
  ocrLines: z.array(scanReportOcrLine).nullable(),
  ocrText: z.string().nullable(),
  durations: z.object({
    codesMs: z.number().nullable(),
    ocrMs: z.number().nullable(),
    fusionMs: z.number().nullable(),
  }),
});

export const scanReportV1 = z.object({
  version: z.literal(SCAN_REPORT_VERSION),
  /** When the label was shot, ISO. */
  shotAt: z.iso.datetime(),
  /** When the user pressed « Envoyer », ISO. */
  createdAt: z.iso.datetime(),
  /** `displayVersion` (YYYY.MM.DD) and the build's own timestamp. */
  app: z.object({ version: z.string(), build: z.string() }),
  device: z.object({
    kind: z.string(),
    userAgent: z.string(),
    platform: z.string().nullable(),
    language: z.string().nullable(),
    screen: z.object({ ...size, pixelRatio: z.number() }),
    standalone: z.boolean(),
  }),
  /** The frame the code readers had, as sent in `image`; null away from the scan screen. */
  shot: z
    .object({
      source: z.enum(['camera', 'import']),
      /** The zoom of the viewfinder (1 = none). */
      zoom: z.number(),
      torch: z.boolean(),
      /** The sharpness check before reading, behind the « illisible » advice. */
      quality: z.enum(['ok', 'blurry', 'glare']),
    })
    .nullable(),
  /** The company's address the fusion weighed (« elsewhere » labels), when set. */
  reception: z.record(z.string(), z.unknown()).nullable(),
  image: z.object({
    type: z.enum(SCAN_REPORT_IMAGE_TYPES),
    ...size,
    bytes: z.number(),
    /** JPEG quality it was encoded at; null for PNG. */
    quality: z.number().nullable(),
  }),
  codes: z.object({
    state: z.enum(['done', 'failed']),
    passes: z.array(scanReportDecodePass),
  }),
  ocr: scanReportOcr,
  /** Every field as the parcel would keep it, the user's corrections weighed in. */
  fields: z.record(z.string(), scanReportField),
  /** The reader's fusion before any correction: fields, candidates, parsed codes, accounts. */
  extraction: z.record(z.string(), z.unknown()),
  corrections: z.array(scanReportCorrection),
  /** The draft as it stood: reading state, carrier, tracking, recipient, sender, annex, pieces. */
  draft: z.looseObject({ id: z.string(), reading: z.string() }),
  /** What the screen showed when the user reported. */
  screen: z.object({
    kind: z.string(),
    fields: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        status: z.string().optional(),
      }),
    ),
  }),
  origin: z.enum(SCAN_REPORT_ORIGINS).optional(),
  missing: z.array(z.enum(SCAN_REPORT_MISSING)).optional(),
  kept: scanReportKept.optional(),
  /** The parcel as the phone keeps it, once past « Terminer ». */
  parcel: z.record(z.string(), z.unknown()).optional(),
});

export type ScanReportV1 = z.infer<typeof scanReportV1>;
