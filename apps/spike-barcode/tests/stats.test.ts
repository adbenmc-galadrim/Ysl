import { describe, expect, it } from 'vitest';
import {
  formatRates,
  groupRates,
  percentile,
  rate,
  timing,
  type Outcome,
} from '#/decode/stats';

const outcome = (over: Partial<Outcome>): Outcome => ({
  source: 'web',
  carrier: 'ups',
  status: 'read',
  seenFormats: [],
  readFormats: [],
  ms: 10,
  ...over,
});

describe('stats', () => {
  it('computes rates per group', () => {
    const all = [
      outcome({ carrier: 'ups' }),
      outcome({ carrier: 'ups', status: 'aucun-code' }),
      outcome({ carrier: 'dpd', status: 'code-sans-tracking' }),
      outcome({ carrier: 'dpd' }),
      outcome({ carrier: 'dpd' }),
    ];
    expect(rate(all)).toEqual({
      total: 5,
      read: 3,
      codeSansTracking: 1,
      aucunCode: 1,
      rate: 0.6,
    });
    const byCarrier = groupRates(all, (o) => o.carrier);
    expect(byCarrier.ups).toMatchObject({ total: 2, read: 1, rate: 0.5 });
    expect(byCarrier.dpd).toMatchObject({ total: 3, read: 2 });
  });

  it('has no division by zero on an empty group', () => {
    expect(rate([])).toEqual({
      total: 0,
      read: 0,
      codeSansTracking: 0,
      aucunCode: 0,
      rate: null,
    });
    expect(groupRates([] as Outcome[], (o) => o.carrier)).toEqual({});
    expect(timing([])).toEqual({ n: 0, p50: null, p95: null });
    expect(percentile([], 50)).toBeNull();
  });

  it('computes p50 and p95 on known series', () => {
    const ten = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    expect(timing(ten)).toEqual({ n: 10, p50: 5, p95: 10 });
    const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(timing(hundred)).toEqual({ n: 100, p50: 50, p95: 95 });
    expect(timing([42])).toEqual({ n: 1, p50: 42, p95: 42 });
  });

  it('counts per format how often the tracking was found when the format was seen', () => {
    const rates = formatRates([
      outcome({
        seenFormats: ['Code128', 'DataMatrix'],
        readFormats: ['Code128'],
      }),
      outcome({ seenFormats: ['Code128'], readFormats: [] }),
      outcome({
        seenFormats: ['Code128', 'Code128'],
        readFormats: ['Code128'],
      }),
    ]);
    expect(rates.Code128).toEqual({ seen: 3, read: 2, rate: 2 / 3 });
    expect(rates.DataMatrix).toEqual({ seen: 1, read: 0, rate: 0 });
  });
});
