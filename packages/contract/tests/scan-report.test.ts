import { describe, expect, it } from 'vitest';
import {
  SCAN_REPORT_JSON_MAX_BYTES,
  SCAN_REPORT_VERSION,
  scanReportBody,
  scanReportV1,
  type ScanReportV1,
} from '@repo/contract/scan-report';

const corner = (x: number, y: number) => ({ x, y });

const report = (lines = 3): ScanReportV1 => ({
  version: SCAN_REPORT_VERSION,
  shotAt: '2026-11-04T09:12:03.000Z',
  createdAt: '2026-11-04T09:12:30.000Z',
  app: { version: '2026.11.04', build: '2026-11-04T08:00:00.000Z' },
  device: {
    kind: 'iphone',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)',
    platform: 'iPhone',
    language: 'fr-FR',
    screen: { width: 420, height: 912, pixelRatio: 3 },
    standalone: true,
  },
  shot: { source: 'camera', zoom: 1, torch: false, quality: 'ok' },
  reception: null,
  image: {
    type: 'image/jpeg',
    width: 3024,
    height: 4032,
    bytes: 2_400_000,
    quality: 0.92,
  },
  codes: {
    state: 'done',
    passes: [
      {
        expect: null,
        symbols: [
          {
            format: 'Code128',
            text: '1Z999AA10123456784',
            isValid: true,
            position: {
              topLeft: corner(400, 900),
              topRight: corner(2400, 900),
              bottomRight: corner(2400, 1200),
              bottomLeft: corner(400, 1200),
            },
            orientation: 0,
          },
        ],
        steps: [
          { name: 'whole-1600', ms: 80, symbols: 1, width: 1200, height: 1600 },
        ],
        width: 3024,
        height: 4032,
        totalMs: 95,
      },
      {
        expect: ['MaxiCode'],
        symbols: [],
        steps: [
          { name: 'maxicode', ms: 300, symbols: 0, width: 3024, height: 4032 },
        ],
        width: 3024,
        height: 4032,
        totalMs: 310,
      },
    ],
  },
  ocr: {
    state: 'done',
    engine: 'paddle',
    width: 1200,
    height: 1600,
    sourceWidth: 1200,
    sourceHeight: 1600,
    input: { maxSide: 1600, quality: 0.8 },
    timings: { prepMs: 40, ocrMs: 900 },
    lines: Array.from({ length: lines }, (_, i) => ({
      text: `LIGNE DE TEST ${i}`,
      box: { x: 10, y: 20 * i, width: 300, height: 18 },
      score: 0.93,
    })),
  },
  fields: {
    tracking: {
      value: '1Z999AA10123456784',
      confidence: 0.99,
      level: 'sure',
      flags: [],
      sources: [
        {
          kind: '1d',
          format: 'Code128',
          confidence: 0.99,
          value: '1Z999AA10123456784',
        },
      ],
      candidates: [],
    },
  },
  extraction: { tracking: null, codes: [] },
  corrections: [{ field: 'recipient', value: 'Camille Martin', how: 'chosen' }],
  draft: { id: '0190f7f2-0000-7000-8000-000000000001', reading: 'read' },
  screen: {
    kind: 'read',
    fields: [
      { label: 'Suivi', value: '1Z 999 AA1 01 2345 6784', status: 'ok' },
    ],
  },
});

describe('scanReportV1', () => {
  it('takes a whole report, and the server takes it as an object', () => {
    const parsed = scanReportV1.parse(JSON.parse(JSON.stringify(report())));
    expect(parsed).toEqual(report());
    expect(scanReportBody.safeParse(parsed).success).toBe(true);
  });

  it('refuses another version or a missing reader', () => {
    expect(scanReportV1.safeParse({ ...report(), version: 2 }).success).toBe(
      false,
    );
    const withoutCodes: Partial<ScanReportV1> = report();
    delete withoutCodes.codes;
    expect(scanReportV1.safeParse(withoutCodes).success).toBe(false);
  });

  it('says the text was not read without inventing lines', () => {
    expect(
      scanReportV1.safeParse({ ...report(), ocr: { state: 'skipped' } })
        .success,
    ).toBe(true);
    expect(
      scanReportV1.safeParse({ ...report(), ocr: { state: 'done' } }).success,
    ).toBe(false);
  });

  it('keeps a crowded label under the size the server takes', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify(report(400)),
    ).byteLength;
    expect(bytes).toBeLessThan(SCAN_REPORT_JSON_MAX_BYTES);
  });
});
