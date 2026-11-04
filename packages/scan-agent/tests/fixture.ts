import {
  SCAN_REPORT_VERSION,
  type ScanReportV1,
} from '@repo/contract/scan-report';

const field = (value: string) => ({
  value,
  confidence: 0.95,
  level: 'sure' as const,
  flags: [],
  sources: [{ kind: '1d', format: 'Code128', confidence: 0.95, value }],
  candidates: [],
});

/** A whole `scanReportV1`, every value invented. */
export const v1Report = (
  fields: Record<string, string> = {},
  extra: Partial<ScanReportV1> = {},
): ScanReportV1 => ({
  version: SCAN_REPORT_VERSION,
  shotAt: '2026-11-04T09:12:03.000Z',
  createdAt: '2026-11-04T09:12:30.000Z',
  app: { version: '2026.11.04', build: '2026-11-04T08:00:00.000Z' },
  device: {
    kind: 'iphone',
    userAgent: 'Mozilla/5.0 (iPhone)',
    platform: 'iPhone',
    language: 'fr-FR',
    screen: { width: 420, height: 912, pixelRatio: 3 },
    standalone: true,
  },
  shot: { source: 'camera', zoom: 1, torch: false, quality: 'ok' },
  reception: null,
  image: {
    type: 'image/jpeg',
    width: 1200,
    height: 1600,
    bytes: 17,
    quality: 0.92,
  },
  codes: { state: 'done', passes: [] },
  ocr: { state: 'skipped' },
  fields: Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, field(v)]),
  ),
  extraction: {},
  corrections: [],
  draft: { id: '0190f7f2-0000-7000-8000-000000000001', reading: 'read' },
  screen: { kind: 'read', fields: [] },
  ...extra,
});
