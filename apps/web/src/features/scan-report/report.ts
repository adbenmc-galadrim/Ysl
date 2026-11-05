import {
  SCAN_REPORT_VERSION,
  type ScanReportImageType,
  type ScanReportV1,
} from '@repo/contract/scan-report';
import type { CompanyReception } from '@repo/contract/company-settings';
import type { OcrResult } from '@repo/ocr/worker';
import type { ScanReading } from '@repo/ui';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { isValidElement, type ReactNode } from 'react';
import { extractionOf } from '#/features/batch/extraction';
import { PHOTO_MAX_SIDE, PHOTO_QUALITY } from '#/features/camera/capture';
import type { FrameVerdict } from '#/features/camera/quality';
import type { DraftParcel } from '#/features/db/schema';
import { deviceKind } from '#/features/devices/describe';
import { annexText } from '#/features/review/actions';
import type { AnnexField } from '#/features/review/model';
import { annexOf } from '#/features/scan/annex';
import { carrierName } from '#/features/scan/carriers';
import { draftFields } from '#/features/scan/confidence';
import type { DecodePass } from '#/features/scan/reader';

/** The text of a shot: read, skipped, failed, or not back yet. */
export type ShotText =
  | { state: 'done'; result: OcrResult }
  | { state: 'skipped' | 'failed' | 'pending' | 'none' };

/** What the readers made of the last shot, kept in memory until it is reported or replaced. */
export type ShotReadings = {
  draftId: string;
  shotAt: Date;
  source: 'camera' | 'import';
  zoom: number;
  torch: boolean;
  quality: FrameVerdict;
  codes: { state: 'done' | 'failed'; passes: DecodePass[] } | null;
  text: ShotText;
};

export type ReportImage = {
  type: ScanReportImageType;
  width: number;
  height: number;
  bytes: number;
  quality: number | null;
};

export type ReportContext = {
  /** `displayVersion(__APP_VERSION__)`, and the build's timestamp. */
  app: ScanReportV1['app'];
  device: ScanReportV1['device'];
  now: Date;
  /** `currentReception()`: what `draftFields` weighs the label against. */
  reception: CompanyReception | null;
};

type Host = Pick<
  Navigator,
  'userAgent' | 'platform' | 'language' | 'maxTouchPoints'
> & { standalone?: boolean };

type Screen = { width: number; height: number; pixelRatio: number };

/** The phone, as the browser describes it. */
export function deviceOf(
  host: Host,
  screen: Screen,
  standalone: boolean,
): ScanReportV1['device'] {
  return {
    kind: deviceKind(host.userAgent),
    userAgent: host.userAgent,
    platform: host.platform || null,
    language: host.language || null,
    screen,
    standalone,
  };
}

export const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const t = createTranslator(DEFAULT_LOCALE);

const ANNEX_FIELDS: readonly AnnexField[] = [
  'pieces',
  'weightKg',
  'service',
  'reference',
];

/**
 * The carrier and the annex as the agent settled them in the batch review,
 * against what the label alone gives: a value changed was typed, a doubt
 * kept as is was confirmed.
 */
function reviewCorrections(draft: DraftParcel): ScanReportV1['corrections'] {
  const out: ScanReportV1['corrections'] = [];
  const read = draftFields(draft).extraction.carrier?.value;
  const named = read ? carrierName(read, t) : null;
  if (draft.trackingConfirmed && draft.carrier && draft.carrier !== named) {
    out.push({ field: 'carrier', value: draft.carrier, how: 'chosen' });
  }
  if (!draft.annex) return out;
  const label = annexOf(draft.symbols, draft.ocrLines);
  for (const field of ANNEX_FIELDS) {
    const now = annexText(field, draft.annex);
    if (now !== annexText(field, label)) {
      out.push({ field, value: now === '' ? null : now, how: 'typed' });
    } else if (
      draft.annex[field]?.level === 'sure' &&
      label[field]?.level !== 'sure'
    ) {
      out.push({ field, value: now, how: 'confirmed' });
    }
  }
  return out;
}

/** What the user set by hand on the draft before the report left, in the review too. */
export function correctionsOf(
  draft: DraftParcel | undefined,
): ScanReportV1['corrections'] {
  if (!draft) return [];
  const out: ScanReportV1['corrections'] = [];
  if (draft.reading === 'typed') {
    out.push({ field: 'tracking', value: draft.tracking, how: 'typed' });
  } else if (draft.trackingConfirmed) {
    out.push({ field: 'tracking', value: draft.tracking, how: 'confirmed' });
  }
  if (draft.recipient?.source === 'agent') {
    out.push({
      field: 'recipient',
      value: draft.recipient.name,
      how: 'chosen',
    });
  }
  if (draft.sender?.source === 'agent') {
    out.push({ field: 'sender', value: draft.sender.name, how: 'chosen' });
  }
  if (draft.type) out.push({ field: 'type', value: draft.type, how: 'chosen' });
  if (draft.departmentId) {
    out.push({ field: 'department', value: draft.departmentId, how: 'chosen' });
  }
  return [...out, ...reviewCorrections(draft)];
}

/** The words of a field as drawn: a node of the screen, flattened to its text. */
function plainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return plainText(node.props.children);
  }
  return '';
}

function screenOf(reading: ScanReading): ScanReportV1['screen'] {
  const fields =
    reading.kind === 'read'
      ? reading.fields.map(({ label, value, status }) => ({
          label: plainText(label),
          value: plainText(value),
          ...(status ? { status } : {}),
        }))
      : [];
  return { kind: reading.kind, fields };
}

function ocrOf(text: ShotText): ScanReportV1['ocr'] {
  if (text.state !== 'done') return { state: text.state };
  const { result } = text;
  return {
    state: 'done',
    engine: result.engine,
    width: result.width,
    height: result.height,
    sourceWidth: result.sourceWidth,
    sourceHeight: result.sourceHeight,
    input: { maxSide: PHOTO_MAX_SIDE, quality: PHOTO_QUALITY },
    timings: { ...result.timings },
    lines: result.lines.map(({ text: line, box, score }) => ({
      text: line,
      box: { ...box },
      score,
    })),
  };
}

/**
 * The whole reading of one label, as `ScanReportV1` fixes it: each reader's
 * own output, the fields and their confidence, the user's corrections, and
 * what the screen said. The draft may be gone (undone): the readings stay.
 */
export function buildReport(
  shot: ShotReadings,
  draft: DraftParcel | undefined,
  reading: ScanReading,
  image: ReportImage,
  { app, device, now, reception }: ReportContext,
): ScanReportV1 {
  const extraction = draft ? extractionOf(draft, now) : null;
  return {
    version: SCAN_REPORT_VERSION,
    shotAt: shot.shotAt.toISOString(),
    createdAt: now.toISOString(),
    app,
    device,
    shot: {
      source: shot.source,
      zoom: shot.zoom,
      torch: shot.torch,
      quality: shot.quality,
    },
    reception: reception ? json(reception) : null,
    image,
    codes: shot.codes
      ? {
          state: shot.codes.state,
          passes: shot.codes.passes.map((pass) => ({
            expect: pass.expect,
            symbols: pass.symbols.map((s) => json(s)),
            steps: pass.steps.map((s) => ({ ...s })),
            width: pass.width,
            height: pass.height,
            totalMs: pass.totalMs,
          })),
        }
      : { state: 'failed', passes: [] },
    ocr: ocrOf(shot.text),
    fields: json(extraction?.fields ?? {}),
    extraction: json(draft ? draftFields(draft).extraction : {}),
    corrections: correctionsOf(draft),
    draft: draft ? json(draft) : { id: shot.draftId, reading: 'gone' },
    screen: screenOf(reading),
  };
}
