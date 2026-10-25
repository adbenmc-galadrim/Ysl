import { describe, expect, it } from 'vitest';
import { jaroWinkler, normalizeName } from '#text';

describe('normalizeName', () => {
  it('folds case, diacritics, punctuation and spacing into one key', () => {
    expect(normalizeName('Metalworks SpA')).toBe('metalworks spa');
    expect(normalizeName('  METALWORKS  S.p.A. ')).toBe('metalworks spa');
    expect(normalizeName('J. R. Martin')).toBe('jr martin');
    expect(normalizeName('A B C')).toBe('abc');
    expect(normalizeName('Frölich & Kaufmann')).toBe('frolich kaufmann');
    expect(normalizeName('Léa Fontaine')).toBe('lea fontaine');
  });

  it('keeps digits and drops everything else', () => {
    expect(normalizeName('Atelier 3B – Paris')).toBe('atelier 3b paris');
    expect(normalizeName('---')).toBe('');
  });

  it('reads compatibility forms as their plain letters', () => {
    expect(normalizeName('Ｍｅｔａｌ ﬁne')).toBe('metal fine');
  });
});

describe('jaroWinkler', () => {
  it('gives the reference values', () => {
    expect(jaroWinkler('MARTHA', 'MARHTA')).toBeCloseTo(0.961, 3);
    expect(jaroWinkler('DWAYNE', 'DUANE')).toBeCloseTo(0.84, 3);
    expect(jaroWinkler('DIXON', 'DICKSONX')).toBeCloseTo(0.813, 3);
  });

  it('is 1 on equal strings and 0 when one is empty', () => {
    expect(jaroWinkler('metalworks spa', 'metalworks spa')).toBe(1);
    expect(jaroWinkler('', 'metalworks spa')).toBe(0);
    expect(jaroWinkler('abc', 'xyz')).toBe(0);
  });

  it('places an OCR slip above the §4.3 threshold and a stranger below', () => {
    expect(
      jaroWinkler('metalworks spa', normalizeName('METALW0RKS SPA')),
    ).toBeGreaterThanOrEqual(0.92);
    expect(
      jaroWinkler('metalworks spa', normalizeName('Atelier Tissage Nord')),
    ).toBeLessThan(0.92);
  });
});
