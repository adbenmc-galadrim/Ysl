import {
  SCAN_REPORT_JSON_MAX_BYTES,
  scanReportV1,
} from '@repo/contract/scan-report';
import type { OcrResult } from '@repo/ocr/worker';
import { describe, expect, it, vi } from 'vitest';
import { ShotKeeper } from '#/features/scan-report/keeper';
import {
  buildReport,
  deviceOf,
  type ShotReadings,
} from '#/features/scan-report/report';
import type { DecodePass } from '#/features/scan/reader';
import { draftOf, line } from './helpers/drafts';

/** A synthetic UPS label: the 1Z key is computed, nothing comes from a real parcel. */
const TRACKING = '1Z999AA10123456784';

const corner = (x: number, y: number) => ({ x, y });

const FIRST: DecodePass = {
  expect: null,
  symbols: [
    {
      format: 'Code128',
      text: TRACKING,
      isValid: true,
      position: {
        topLeft: corner(410, 1220),
        topRight: corner(2610, 1225),
        bottomRight: corner(2608, 1520),
        bottomLeft: corner(408, 1515),
      },
      orientation: 0,
    },
  ],
  steps: [
    { name: 'whole-1600', ms: 84, symbols: 1, width: 1200, height: 1600 },
  ],
  width: 3024,
  height: 4032,
  totalMs: 97,
};

const SECOND: DecodePass = {
  expect: ['MaxiCode'],
  symbols: [],
  steps: [{ name: 'maxicode', ms: 310, symbols: 0, width: 3024, height: 4032 }],
  width: 3024,
  height: 4032,
  totalMs: 320,
};

const OCR: OcrResult = {
  lines: [
    line('SHIP TO:'),
    line('CAMILLE MOREL'),
    line(`TRACKING #: ${TRACKING}`),
  ],
  engine: 'paddle',
  width: 1200,
  height: 1600,
  sourceWidth: 1200,
  sourceHeight: 1600,
  timings: { prepMs: 30, ocrMs: 820 },
};

const SHOT: ShotReadings = {
  draftId: 'd',
  shotAt: new Date('2026-11-04T09:12:03Z'),
  source: 'camera',
  zoom: 1.5,
  torch: true,
  quality: 'blurry',
  codes: { state: 'done', passes: [FIRST, SECOND] },
  text: { state: 'done', result: OCR },
};

const IMAGE = {
  type: 'image/jpeg' as const,
  width: 3024,
  height: 4032,
  bytes: 2_400_000,
  quality: 0.92,
};

const CONTEXT = {
  app: { version: '2026.11.04', build: '2026-11-04T08:00:00.000Z' },
  device: deviceOf(
    {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      language: 'fr-FR',
      maxTouchPoints: 5,
    },
    { width: 420, height: 912, pixelRatio: 3 },
    true,
  ),
  now: new Date('2026-11-04T09:12:30Z'),
  reception: null,
};

const READ = {
  kind: 'read' as const,
  fields: [
    { label: 'Suivi', value: '1Z 999 AA1 01 2345 6784', status: 'ok' as const },
  ],
};

const DRAFT = draftOf({
  carrier: 'ups',
  tracking: TRACKING,
  trackingNorm: TRACKING,
  symbols: [{ format: 'Code128', text: TRACKING }],
  ocrLines: OCR.lines,
  ocrName: 'CAMILLE MOREL',
  recipient: {
    kind: 'person',
    id: 'p1',
    name: 'Camille Martin',
    source: 'agent',
  },
});

describe('buildReport', () => {
  it('carries each reader raw, the fields, the device and the app', () => {
    const report = buildReport(SHOT, DRAFT, READ, IMAGE, CONTEXT);

    expect(scanReportV1.parse(JSON.parse(JSON.stringify(report)))).toEqual(
      report,
    );
    expect(report.codes.passes.map((p) => p.expect)).toEqual([
      null,
      ['MaxiCode'],
    ]);
    expect(report.codes.passes[0]!.symbols[0]!.position).toEqual(
      FIRST.symbols[0]!.position,
    );
    expect(report.ocr).toMatchObject({
      state: 'done',
      engine: 'paddle',
      input: { maxSide: 1600, quality: 0.8 },
      lines: OCR.lines,
    });
    expect(report.fields.tracking).toMatchObject({ value: TRACKING });
    expect(report.fields.tracking!.confidence).toBeGreaterThan(0);
    expect(report.extraction).toHaveProperty('codes');
    expect(report.app.version).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(report.device).toMatchObject({ kind: 'iphone', standalone: true });
    expect(report.shot).toEqual({
      source: 'camera',
      zoom: 1.5,
      torch: true,
      quality: 'blurry',
    });
    expect(report.screen).toEqual({ kind: 'read', fields: READ.fields });
  });

  it('says what the user set by hand', () => {
    const report = buildReport(
      SHOT,
      { ...DRAFT, reading: 'typed', type: 'recommande' },
      READ,
      IMAGE,
      CONTEXT,
    );
    expect(report.corrections).toEqual([
      { field: 'tracking', value: TRACKING, how: 'typed' },
      { field: 'recipient', value: 'Camille Martin', how: 'chosen' },
      { field: 'type', value: 'recommande', how: 'chosen' },
    ]);
  });

  it('keeps the readings of a draft undone meanwhile', () => {
    const report = buildReport(
      { ...SHOT, codes: null, text: { state: 'skipped' } },
      undefined,
      { kind: 'unreadable', title: 'Illisible', hint: '' },
      IMAGE,
      CONTEXT,
    );
    expect(scanReportV1.safeParse(report).success).toBe(true);
    expect(report.draft).toEqual({ id: 'd', reading: 'gone' });
    expect(report.codes).toEqual({ state: 'failed', passes: [] });
    expect(report.ocr).toEqual({ state: 'skipped' });
    expect(report.corrections).toEqual([]);
  });

  it('stays under the server limit on a crowded label', () => {
    const many = Array.from({ length: 300 }, (_, i) =>
      line(`LIGNE IMPRIMEE ${i} AVEC DU TEXTE`),
    );
    const report = buildReport(
      { ...SHOT, text: { state: 'done', result: { ...OCR, lines: many } } },
      { ...DRAFT, ocrLines: many },
      READ,
      IMAGE,
      CONTEXT,
    );
    const bytes = new TextEncoder().encode(JSON.stringify(report)).byteLength;
    expect(bytes).toBeLessThan(SCAN_REPORT_JSON_MAX_BYTES);
  });
});

const closes = new Map<ImageBitmap, () => void>();

const frame = () => {
  const close = vi.fn();
  const bitmap = { width: 3024, height: 4032, close } as unknown as ImageBitmap;
  closes.set(bitmap, close);
  return bitmap;
};

const shot = { ...SHOT, codes: undefined, text: undefined };

describe('ShotKeeper', () => {
  it('offers a shot once its codes are read, and only once', async () => {
    const keeper = new ShotKeeper();
    keeper.keep(shot, frame());
    expect(keeper.has()).toBe(false);
    keeper.codes('d', { state: 'done', passes: [FIRST] });
    expect(keeper.has()).toBe(true);

    const taken = await keeper.take();
    expect(taken?.codes?.passes).toEqual([FIRST]);
    expect(taken?.text).toEqual({ state: 'none' });
    expect(keeper.has()).toBe(false);
    expect(await keeper.take()).toBeNull();
  });

  it('closes the former frame when a new shot comes', () => {
    const keeper = new ShotKeeper();
    const first = frame();
    keeper.keep(shot, first);
    keeper.keep({ ...shot, draftId: 'e' }, frame());
    expect(closes.get(first)).toHaveBeenCalled();
    keeper.codes('d', { state: 'done', passes: [] });
    expect(keeper.has()).toBe(false);
  });

  it('waits for the text still being read, up to a limit', async () => {
    const keeper = new ShotKeeper();
    keeper.keep(shot, frame());
    keeper.codes('d', { state: 'done', passes: [] });
    keeper.text('d', Promise.resolve({ state: 'done', result: OCR }));
    expect((await keeper.take())?.text).toEqual({
      state: 'done',
      result: OCR,
    });

    keeper.keep(shot, frame());
    keeper.text('d', new Promise(() => undefined));
    expect((await keeper.take(10))?.text).toEqual({ state: 'pending' });
  });
});
