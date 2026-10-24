import { describe, expect, it } from 'vitest';
import type { FieldOutcome } from '#measure';
import {
  fieldStats,
  formatStats,
  type LabelResult,
  objectives,
  percentile,
  scopes,
} from '#metrics';

const outcome = (
  field: FieldOutcome['field'],
  status: FieldOutcome['status'],
  sources: string[] = [],
  inTop3 = status.endsWith('-ok'),
): FieldOutcome => ({
  field,
  expected: 'x',
  proposed: 'y',
  confidence: 0.9,
  status,
  inTop3,
  sources,
});

const result = (over: Partial<LabelResult>): LabelResult => ({
  id: 'r',
  source: 'web',
  carrier: 'ups',
  policy: 'first',
  reviewed: true,
  pdfSpecimen: false,
  trackingKnown: true,
  difficulties: [],
  formats: [],
  steps: [],
  decodeMs: 100,
  extractMs: 1,
  fields: [],
  ...over,
});

describe('percentile', () => {
  it('returns the single value for p50 and p95, null when empty', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([], 95)).toBeNull();
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
  });
});

describe('fieldStats and objectives', () => {
  const results = [
    result({ fields: [outcome('tracking', 'sure-ok', ['2d:Aztec'])] }),
    result({ fields: [outcome('tracking', 'sure-wrong', ['1d:Code128'])] }),
    result({ fields: [outcome('tracking', 'verify-ok', ['1d:Code128'])] }),
    result({ fields: [outcome('tracking', 'empty')] }),
    result({ fields: [outcome('tracking', 'not-annotated')] }),
  ];

  it('counts only annotated labels and each status once', () => {
    expect(fieldStats(results, 'tracking')).toMatchObject({
      annotated: 4,
      sureOk: 1,
      sureWrong: 1,
      verifyOk: 1,
      empty: 1,
      exact: 0.5,
      falseSure: 0.25,
      prefilled: 0.75,
    });
    expect(fieldStats(results, 'sender').exact).toBeNull();
  });

  it('counts exactly the sure-wrong trackings in O1', () => {
    const o1 = objectives(results).find((o) => o.id === 'O1')!;
    expect(o1).toMatchObject({ value: 1, met: false });
    const o5 = objectives(results).find((o) => o.id === 'O5')!;
    expect(o5.met).toBeNull();
  });
});

describe('scopes', () => {
  const results = [
    result({ id: 'web-usps', carrier: 'usps', pdfSpecimen: false }),
    result({ id: 'guide-colissimo', carrier: 'colissimo', pdfSpecimen: true }),
    result({ id: 'no-tracking', trackingKnown: false }),
    result({ id: 'synthetic', source: 'synthetic' }),
    result({ id: 'real', source: 'real' }),
  ];

  it('builds the reader base without PDF specimens nor unknown trackings', () => {
    const byName = Object.fromEntries(scopes(results).map((s) => [s.name, s]));
    expect(byName['reader']!.results.map((r) => r.id)).toEqual([
      'web-usps',
      'real',
    ]);
    expect(byName['web-real']!.results).toHaveLength(3);
    expect(byName['pdf-specimens']!.results.map((r) => r.id)).toEqual([
      'guide-colissimo',
    ]);
    expect(byName['synthetic']!.results).toHaveLength(1);
  });
});

describe('formatStats', () => {
  it('credits a format when it carried the right tracking', () => {
    const stats = formatStats([
      result({
        formats: ['Code128', 'Aztec', 'Aztec'],
        fields: [outcome('tracking', 'sure-ok', ['2d:Aztec'])],
      }),
      result({
        formats: ['Code128'],
        fields: [outcome('tracking', 'sure-wrong', ['1d:Code128'])],
      }),
    ]);
    expect(stats).toEqual({
      Code128: { seen: 2, carriedTracking: 0 },
      Aztec: { seen: 1, carriedTracking: 1 },
    });
  });
});
