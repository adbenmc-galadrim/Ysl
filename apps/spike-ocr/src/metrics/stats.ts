import type { PhotoResult } from '#/metrics/types';

export type Summary = {
  count: number;
  p50: number | undefined;
  p95: number | undefined;
  max: number | undefined;
};

export type SeriesStats = {
  photos: number;
  failures: number;
  total: Summary;
  prep: Summary;
  ocr: Summary;
  maxWasmHeapBytes: number | undefined;
  maxJsHeapBytes: number | undefined;
};

export function percentile(
  values: readonly number[],
  rank: number,
): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1)];
}

export function summarize(values: readonly number[]): Summary {
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: values.length === 0 ? undefined : Math.max(...values),
  };
}

function maxOf(values: readonly (number | undefined)[]): number | undefined {
  const defined = values.filter(
    (value): value is number => value !== undefined,
  );
  return defined.length === 0 ? undefined : Math.max(...defined);
}

export function seriesStats(photos: readonly PhotoResult[]): SeriesStats {
  const succeeded = photos.filter((photo) => photo.ok);
  return {
    photos: photos.length,
    failures: photos.length - succeeded.length,
    total: summarize(succeeded.map((photo) => photo.totalMs)),
    prep: summarize(succeeded.map((photo) => photo.prepMs)),
    ocr: summarize(succeeded.map((photo) => photo.ocrMs)),
    maxWasmHeapBytes: maxOf(succeeded.map((photo) => photo.wasmHeapBytes)),
    maxJsHeapBytes: maxOf(succeeded.map((photo) => photo.jsHeapBytes)),
  };
}
