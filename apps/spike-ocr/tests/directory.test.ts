import { describe, expect, it } from 'vitest';
import {
  buildDirectory,
  DIRECTORY_SIZE,
  matchRecipient,
} from '#/scoring/directory';
import { editDistance, normalizeWords } from '#/scoring/text';

const people = [
  'Jade Mercier',
  'Jade Mercer',
  'Léa Dupuis',
  'Léa Dupuy',
  'Léa Dupuit',
  'Raphaël Nguyen',
  'Pierre-Yves Dolbec',
  'Zoé Faure',
  'Camille Bernard',
];

const best = (lines: string[], directory = people) =>
  matchRecipient(lines, directory)[0]?.name;

describe('matchRecipient on noisy OCR', () => {
  it('finds the person despite a missing letter', () => {
    expect(best(['JADE MERCIR'])).toBe('Jade Mercier');
  });

  it('ignores case and accents', () => {
    expect(best(['raphael nguyen'])).toBe('Raphaël Nguyen');
    expect(best(['LEA DUPUIS'])).toBe('Léa Dupuis');
  });

  it('accepts first and last name swapped', () => {
    expect(best(['NGUYEN RAPHAEL'])).toBe('Raphaël Nguyen');
    expect(best(['DOLBEC PIERRE YVES'])).toBe('Pierre-Yves Dolbec');
  });

  it('joins a name split over two lines', () => {
    expect(best(['12 RUE DE LA PAIX', 'ZOE', 'FAURE', '75001 PARIS'])).toBe(
      'Zoé Faure',
    );
  });

  it('finds the name inside a longer line', () => {
    expect(best(['M. CAMILLE BERNARD 4 RUE VICTOR HUGO'])).toBe(
      'Camille Bernard',
    );
  });

  it('never ranks a close namesake above the exact name', () => {
    expect(best(['LEA DUPUIS'])).toBe('Léa Dupuis');
    expect(best(['LEA DUPUY'])).toBe('Léa Dupuy');
    expect(best(['LEA DUPUIT'])).toBe('Léa Dupuit');
    expect(best(['JADE MERCIER'])).toBe('Jade Mercier');
  });

  it('keeps the namesakes in the top 3 behind the exact name', () => {
    const names = matchRecipient(['LEA DUPUIS'], people).map(
      (match) => match.name,
    );
    expect(names[0]).toBe('Léa Dupuis');
    expect(names.slice(1).sort()).toEqual(['Léa Dupuit', 'Léa Dupuy']);
  });

  it('returns nothing when no line looks like any name', () => {
    expect(matchRecipient(['COLISSIMO', '8J25313273378'], people)).toEqual([]);
  });
});

describe('buildDirectory', () => {
  const recipients = Array.from({ length: 91 }, (_, i) => `Prénom${i} Nom${i}`);

  it('keeps every recipient and completes up to 120 entries', () => {
    const directory = buildDirectory(recipients);
    expect(directory).toHaveLength(DIRECTORY_SIZE);
    for (const recipient of recipients) expect(directory).toContain(recipient);
  });

  it('is reproducible and has no duplicates', () => {
    const first = buildDirectory(recipients);
    expect(buildDirectory(recipients)).toEqual(first);
    const keys = first.map(normalizeWords);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('adds namesakes one letter away from a real recipient', () => {
    const real = ['Jade Mercier', 'Léa Dupuis', 'Hugo Roux', 'Zoé Faure'];
    const added = buildDirectory(real, { size: 120 }).slice(real.length);
    const close = added.filter((name) =>
      real.some((r) => {
        const [first = '', ...rest] = normalizeWords(r).split(' ');
        const candidate = normalizeWords(name);
        return (
          candidate.startsWith(`${first} `) &&
          editDistance(normalizeWords(r), candidate) <= 1 &&
          rest.length > 0
        );
      }),
    );
    expect(close.length).toBeGreaterThan(5);
  });
});
