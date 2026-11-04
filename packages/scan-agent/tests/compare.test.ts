import { describe, expect, it } from 'vitest';
import { type BenchResults, compareResults, comparisonTable } from '#compare';

type Status =
  | 'sure-ok'
  | 'verify-ok'
  | 'sure-wrong'
  | 'verify-wrong'
  | 'empty'
  | 'not-annotated';

const results = (
  rows: [id: string, field: string, status: Status][],
): BenchResults => ({
  results: ['first', 'thorough'].flatMap((policy) =>
    [...new Set(rows.map(([id]) => id))].map((id) => ({
      id,
      policy,
      fields: rows
        .filter(([rowId]) => rowId === id)
        .map(([, field, status]) => ({ field, status })),
    })),
  ),
});

const LABEL = 'rapport-0b5e1c3a';

const BEFORE = results([
  ['synthetic-ups-01', 'tracking', 'sure-ok'],
  ['synthetic-ups-01', 'weightKg', 'verify-ok'],
  [LABEL, 'tracking', 'sure-ok'],
  [LABEL, 'weightKg', 'sure-wrong'],
]);

describe('compareResults', () => {
  it('accepts a fix that reads the reported label right, nothing moving back', () => {
    const after = results([
      ['synthetic-ups-01', 'tracking', 'sure-ok'],
      ['synthetic-ups-01', 'weightKg', 'sure-ok'],
      [LABEL, 'tracking', 'sure-ok'],
      [LABEL, 'weightKg', 'sure-ok'],
    ]);
    const comparison = compareResults(BEFORE, after, LABEL);
    expect(comparison.regressions).toEqual([]);
    expect(comparison.gains).toEqual([
      'weightKg (first)',
      'weightKg (thorough)',
    ]);
    expect(comparison.labels).toBe(2);
    expect(comparisonTable(comparison)).toContain(
      '| weightKg | first | 50.0 % (1/2) | 100.0 % (2/2) | 1 → 0 |',
    );
  });

  it('refuses a label read right before and not after, even with a gain elsewhere', () => {
    const after = results([
      ['synthetic-ups-01', 'tracking', 'sure-ok'],
      ['synthetic-ups-01', 'weightKg', 'empty'],
      [LABEL, 'tracking', 'sure-ok'],
      [LABEL, 'weightKg', 'sure-ok'],
    ]);
    expect(compareResults(BEFORE, after, LABEL).regressions).toEqual([
      'recul : weightKg (first) sur synthetic-ups-01',
      'recul : weightKg (thorough) sur synthetic-ups-01',
    ]);
  });

  it('refuses a new false « sûr » and fewer right readings', () => {
    const after = results([
      ['synthetic-ups-01', 'tracking', 'sure-wrong'],
      ['synthetic-ups-01', 'weightKg', 'verify-ok'],
      [LABEL, 'tracking', 'sure-ok'],
      [LABEL, 'weightKg', 'sure-wrong'],
    ]);
    const { regressions, gains } = compareResults(BEFORE, after, LABEL);
    expect(gains).toEqual([]);
    expect(regressions).toEqual(
      expect.arrayContaining([
        'tracking (first) : 2 justes avant, 1 après',
        'tracking (first) : 0 faux « sûr » avant, 1 après',
      ]),
    );
  });

  it('refuses two measures on different labels', () => {
    const after = results([['synthetic-ups-01', 'tracking', 'sure-ok']]);
    expect(compareResults(BEFORE, after, LABEL).regressions[0]).toBe(
      'les deux mesures ne portent pas sur les mêmes étiquettes',
    );
  });
});
