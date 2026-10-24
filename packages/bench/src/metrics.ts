import type { Carrier, Source } from '@repo/corpus/schema';
import { FIELDS, type FieldName, type FieldOutcome } from '#measure';

export type LabelResult = {
  id: string;
  source: Source;
  carrier: Carrier;
  policy: string;
  reviewed: boolean;
  pdfSpecimen: boolean;
  trackingKnown: boolean;
  difficulties: string[];
  formats: string[];
  steps: { name: string; ms: number; symbols: number }[];
  decodeMs: number;
  extractMs: number;
  fields: FieldOutcome[];
  error?: string;
};

export type FieldStats = {
  annotated: number;
  sureOk: number;
  sureWrong: number;
  verifyOk: number;
  verifyWrong: number;
  empty: number;
  top3: number;
  exact: number | null;
  falseSure: number | null;
  prefilled: number | null;
  top3Rate: number | null;
};

export type Timing = { n: number; p50: number | null; p95: number | null };

export type FormatStats = { seen: number; carriedTracking: number };

export type ScopeName =
  'reader' | 'web-real' | 'real' | 'pdf-specimens' | 'synthetic';

export type Scope = { name: ScopeName; title: string; results: LabelResult[] };

export type Objective = {
  id: string;
  title: string;
  value: number | null;
  display: string;
  target: string;
  met: boolean | null;
};

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

const ratio = (part: number, whole: number) =>
  whole === 0 ? null : part / whole;

export const fieldStats = (
  results: readonly LabelResult[],
  field: FieldName,
): FieldStats => {
  const outcomes = results.flatMap((r) =>
    r.fields.filter((f) => f.field === field && f.status !== 'not-annotated'),
  );
  const count = (status: FieldOutcome['status']) =>
    outcomes.filter((o) => o.status === status).length;
  const sureOk = count('sure-ok');
  const sureWrong = count('sure-wrong');
  const verifyOk = count('verify-ok');
  const verifyWrong = count('verify-wrong');
  const top3 = outcomes.filter((o) => o.inTop3).length;
  const n = outcomes.length;
  return {
    annotated: n,
    sureOk,
    sureWrong,
    verifyOk,
    verifyWrong,
    empty: count('empty'),
    top3,
    exact: ratio(sureOk + verifyOk, n),
    falseSure: ratio(sureWrong, n),
    prefilled: ratio(sureOk + sureWrong + verifyOk + verifyWrong, n),
    top3Rate: ratio(top3, n),
  };
};

export const allFieldStats = (results: readonly LabelResult[]) =>
  Object.fromEntries(FIELDS.map((f) => [f, fieldStats(results, f)])) as Record<
    FieldName,
    FieldStats
  >;

export const groupBy = <T>(
  items: readonly T[],
  key: (item: T) => string,
): Record<string, T[]> => {
  const groups: Record<string, T[]> = {};
  for (const item of items) (groups[key(item)] ??= []).push(item);
  return groups;
};

export const formatStats = (
  results: readonly LabelResult[],
): Record<string, FormatStats> => {
  const stats: Record<string, FormatStats> = {};
  for (const r of results) {
    const tracking = r.fields.find((f) => f.field === 'tracking');
    const carrying = new Set(
      (tracking?.status === 'sure-ok' || tracking?.status === 'verify-ok'
        ? tracking.sources
        : []
      ).map((s) => s.split(':')[1]!),
    );
    for (const format of new Set(r.formats)) {
      const entry = (stats[format] ??= { seen: 0, carriedTracking: 0 });
      entry.seen += 1;
      if (carrying.has(format)) entry.carriedTracking += 1;
    }
  }
  return stats;
};

export const totalMs = (r: LabelResult) => r.decodeMs + r.extractMs;

export const scopes = (results: readonly LabelResult[]): Scope[] => {
  const webReal = results.filter(
    (r) => r.source !== 'synthetic' && r.trackingKnown,
  );
  return [
    {
      name: 'reader',
      title: 'Web + réelles, tracking connu, sans les spécimens PDF',
      results: webReal.filter((r) => !r.pdfSpecimen),
    },
    {
      name: 'web-real',
      title: 'Web + réelles, tracking connu',
      results: webReal,
    },
    {
      name: 'real',
      title: 'Photos réelles',
      results: results.filter((r) => r.source === 'real'),
    },
    {
      name: 'pdf-specimens',
      title: 'Spécimens des guides PDF à 105 ppi (Colissimo, DPD)',
      results: results.filter((r) => r.pdfSpecimen),
    },
    {
      name: 'synthetic',
      title: 'Synthèse (témoin)',
      results: results.filter((r) => r.source === 'synthetic'),
    },
  ];
};

const pct = (value: number | null) =>
  value === null ? '—' : `${(value * 100).toFixed(1).replace('.', ',')} %`;

const ms = (value: number | null) =>
  value === null ? '—' : `${Math.round(value)} ms`;

/** O1 to O6 of the specification (§10), O5 being out of a corpus's reach. */
export const objectives = (results: readonly LabelResult[]): Objective[] => {
  const stats = allFieldStats(results);
  const times = timing(results.map(totalMs));
  const others = (
    ['carrier', 'recipient', 'sender', 'pieces', 'weightKg'] as const
  )
    .map((f) => stats[f].falseSure)
    .filter((v): v is number => v !== null);
  const worstOther = others.length === 0 ? null : Math.max(...others);
  return [
    {
      id: 'O1',
      title: 'Faux « sûrs » sur le tracking',
      value: stats.tracking.sureWrong,
      display: String(stats.tracking.sureWrong),
      target: '0',
      met: stats.tracking.sureWrong === 0,
    },
    {
      id: 'O2',
      title: 'Tracking prérempli et juste',
      value: stats.tracking.exact,
      display: pct(stats.tracking.exact),
      target: '≥ 95 %',
      met: stats.tracking.exact === null ? null : stats.tracking.exact >= 0.95,
    },
    {
      id: 'O3',
      title: 'Destinataire juste ou dans les 3 suggestions',
      value: stats.recipient.top3Rate,
      display: pct(stats.recipient.top3Rate),
      target: '≥ 95 %',
      met:
        stats.recipient.top3Rate === null
          ? null
          : stats.recipient.top3Rate >= 0.95,
    },
    {
      id: 'O4',
      title: 'Expéditeur juste ou proposé',
      value: stats.sender.top3Rate,
      display: pct(stats.sender.top3Rate),
      target: '≥ 70 %',
      met: stats.sender.top3Rate === null ? null : stats.sender.top3Rate >= 0.7,
    },
    {
      id: 'O5',
      title: 'Délai entre deux captures',
      value: null,
      display: 'non mesuré ici (banc S1, YSL-23)',
      target: '≤ 1 s',
      met: null,
    },
    {
      id: 'O6',
      title: 'Temps par photo (Mac, décodage + extraction)',
      value: times.p95,
      display: `p50 ${ms(times.p50)}, p95 ${ms(times.p95)}`,
      target: 'p50 ≤ 3 s, p95 ≤ 5 s sur iPhone',
      met:
        times.p50 === null || times.p95 === null
          ? null
          : times.p50 <= 3000 && times.p95 <= 5000,
    },
    {
      id: 'FS',
      title: 'Faux « sûrs » sur les autres champs (pire champ)',
      value: worstOther,
      display: pct(worstOther),
      target: '≤ 2 %',
      met: worstOther === null ? null : worstOther <= 0.02,
    },
  ];
};

export { pct, ms };
