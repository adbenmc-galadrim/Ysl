import type { MatchStatus } from './match.ts';

export type Outcome = {
  source: string;
  carrier: string;
  status: MatchStatus;
  seenFormats: string[];
  readFormats: string[];
  ms: number;
};

export type Rate = {
  total: number;
  read: number;
  codeSansTracking: number;
  aucunCode: number;
  rate: number | null;
};

export type Timing = { n: number; p50: number | null; p95: number | null };

export type FormatRate = { seen: number; read: number; rate: number | null };

export const percentile = (values: readonly number[], p: number) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1]!;
};

export const timing = (values: readonly number[]): Timing => ({
  n: values.length,
  p50: percentile(values, 50),
  p95: percentile(values, 95),
});

export const rate = (outcomes: readonly Outcome[]): Rate => {
  const count = (status: MatchStatus) =>
    outcomes.filter((o) => o.status === status).length;
  const read = count('read');
  return {
    total: outcomes.length,
    read,
    codeSansTracking: count('code-sans-tracking'),
    aucunCode: count('aucun-code'),
    rate: outcomes.length === 0 ? null : read / outcomes.length,
  };
};

export const groupRates = <T extends Outcome>(
  outcomes: readonly T[],
  key: (outcome: T) => string,
): Record<string, Rate> => {
  const groups = new Map<string, T[]>();
  for (const o of outcomes) {
    const k = key(o);
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  return Object.fromEntries([...groups].map(([k, v]) => [k, rate(v)]));
};

export const formatRates = (
  outcomes: readonly Outcome[],
): Record<string, FormatRate> => {
  const seen = new Map<string, number>();
  const read = new Map<string, number>();
  for (const o of outcomes) {
    for (const f of new Set(o.seenFormats)) seen.set(f, (seen.get(f) ?? 0) + 1);
    for (const f of new Set(o.readFormats)) read.set(f, (read.get(f) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...seen].map(([f, n]) => {
      const r = read.get(f) ?? 0;
      return [f, { seen: n, read: r, rate: n === 0 ? null : r / n }];
    }),
  );
};
