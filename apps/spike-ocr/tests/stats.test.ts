import { describe, expect, it } from 'vitest';
import { percentile, seriesStats, summarize } from '#/metrics/stats';
import type { PhotoResult } from '#/metrics/types';

const twenty = Array.from({ length: 20 }, (_, i) => i + 1);

describe('percentile', () => {
  it('returns the only value of a one-value series', () => {
    expect(summarize([42])).toEqual({ count: 1, p50: 42, p95: 42, max: 42 });
  });

  it('uses the nearest rank on two values', () => {
    expect(summarize([10, 20])).toEqual({
      count: 2,
      p50: 10,
      p95: 20,
      max: 20,
    });
  });

  it('finds p50 and p95 on twenty values whatever their order', () => {
    expect(percentile(twenty, 50)).toBe(10);
    expect(percentile(twenty, 95)).toBe(19);
    expect(percentile([...twenty].reverse(), 95)).toBe(19);
    expect(summarize(twenty).max).toBe(20);
  });

  it('has nothing to say about an empty series', () => {
    expect(summarize([])).toEqual({
      count: 0,
      p50: undefined,
      p95: undefined,
      max: undefined,
    });
  });
});

function photo(
  totalMs: number,
  ok = true,
  wasmHeapBytes?: number,
): PhotoResult {
  return {
    id: `p${totalMs}`,
    name: 'p.jpg',
    ok,
    prepMs: 1,
    ocrMs: totalMs - 1,
    totalMs,
    wasmHeapBytes,
  };
}

describe('seriesStats', () => {
  it('leaves failed photos out of the timings but counts them', () => {
    const stats = seriesStats([
      ...twenty.map((n) => photo(n, true, n * 1000)),
      photo(60_000, false, 999_999),
    ]);
    expect(stats.photos).toBe(21);
    expect(stats.failures).toBe(1);
    expect(stats.total.count).toBe(20);
    expect(stats.total.p95).toBe(19);
    expect(stats.total.max).toBe(20);
    expect(stats.maxWasmHeapBytes).toBe(20_000);
  });
});
