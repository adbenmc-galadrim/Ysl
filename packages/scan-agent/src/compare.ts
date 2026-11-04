import { z } from 'zod';

/** The part of the bench's `results.json` the comparison reads. */
const resultsSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      policy: z.string(),
      fields: z.array(z.object({ field: z.string(), status: z.string() })),
    }),
  ),
});

export type BenchResults = z.infer<typeof resultsSchema>;

export const parseResults = (json: unknown): BenchResults =>
  resultsSchema.parse(json);

const OK = new Set(['sure-ok', 'verify-ok']);

export type Count = { annotated: number; ok: number; falseSure: number };

export type Row = {
  policy: string;
  field: string;
  before: Count;
  after: Count;
};

export type Comparison = {
  labels: number;
  rows: Row[];
  /** Empty: nothing moved back. */
  regressions: string[];
  /** Fields of the reported label read right after, wrong before. */
  gains: string[];
};

const key = (policy: string, field: string) => `${policy}\u0000${field}`;

function tally(results: BenchResults): Map<string, Count> {
  const counts = new Map<string, Count>();
  for (const result of results.results) {
    for (const outcome of result.fields) {
      if (outcome.status === 'not-annotated') continue;
      const k = key(result.policy, outcome.field);
      const count = counts.get(k) ?? { annotated: 0, ok: 0, falseSure: 0 };
      count.annotated += 1;
      if (OK.has(outcome.status)) count.ok += 1;
      if (outcome.status === 'sure-wrong') count.falseSure += 1;
      counts.set(k, count);
    }
  }
  return counts;
}

function outcomes(results: BenchResults): Map<string, string> {
  const map = new Map<string, string>();
  for (const result of results.results) {
    for (const outcome of result.fields) {
      map.set(
        `${result.id}\u0000${key(result.policy, outcome.field)}`,
        outcome.status,
      );
    }
  }
  return map;
}

const labelsOf = (results: BenchResults) =>
  [...new Set(results.results.map((r) => r.id))].sort();

/**
 * No field may move back, on the whole corpus or on any label: fewer right
 * readings, more false « sûr », a label read right before and not after.
 */
export function compareResults(
  before: BenchResults,
  after: BenchResults,
  labelId: string,
): Comparison {
  const regressions: string[] = [];
  const labels = labelsOf(before);
  if (labels.join('\n') !== labelsOf(after).join('\n')) {
    regressions.push(
      'les deux mesures ne portent pas sur les mêmes étiquettes',
    );
  }
  if (!labels.includes(labelId)) {
    regressions.push(`l’étiquette ${labelId} manque au corpus mesuré`);
  }

  const beforeCounts = tally(before);
  const afterCounts = tally(after);
  const empty: Count = { annotated: 0, ok: 0, falseSure: 0 };
  const rows: Row[] = [
    ...new Set([...beforeCounts.keys(), ...afterCounts.keys()]),
  ]
    .sort()
    .map((k) => {
      const [policy = '', field = ''] = k.split('\u0000');
      return {
        policy,
        field,
        before: beforeCounts.get(k) ?? empty,
        after: afterCounts.get(k) ?? empty,
      };
    });
  for (const { policy, field, before: b, after: a } of rows) {
    if (a.ok < b.ok) {
      regressions.push(
        `${field} (${policy}) : ${b.ok} justes avant, ${a.ok} après`,
      );
    }
    if (a.falseSure > b.falseSure) {
      regressions.push(
        `${field} (${policy}) : ${b.falseSure} faux « sûr » avant, ${a.falseSure} après`,
      );
    }
  }

  const beforeOutcomes = outcomes(before);
  const afterOutcomes = outcomes(after);
  const gains: string[] = [];
  const lost = new Set<string>();
  for (const [k, status] of beforeOutcomes) {
    const now = afterOutcomes.get(k);
    const [id, policy, field] = k.split('\u0000');
    if (OK.has(status) && (now === undefined || !OK.has(now))) {
      lost.add(
        id === labelId
          ? `${field} (${policy}) sur l’étiquette signalée`
          : `${field} (${policy}) sur ${id}`,
      );
    }
    if (id === labelId && !OK.has(status) && now !== undefined && OK.has(now)) {
      gains.push(`${field} (${policy})`);
    }
  }
  for (const what of lost) regressions.push(`recul : ${what}`);

  return { labels: labels.length, rows, regressions, gains };
}

const rate = ({ ok, annotated }: Count) =>
  annotated === 0
    ? '—'
    : `${((100 * ok) / annotated).toFixed(1)} % (${ok}/${annotated})`;

/** Aggregates only: what the public PR may show. */
export function comparisonTable(comparison: Comparison): string {
  const lines = [
    '| Champ | Politique | Avant | Après | Faux « sûr » avant → après |',
    '| --- | --- | --- | --- | --- |',
    ...comparison.rows.map(
      ({ field, policy, before, after }) =>
        `| ${field} | ${policy} | ${rate(before)} | ${rate(after)} | ${before.falseSure} → ${after.falseSure} |`,
    ),
  ];
  return lines.join('\n');
}
