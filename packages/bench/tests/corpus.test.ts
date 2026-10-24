import { describe, expect, it } from 'vitest';
import type { BenchLabel } from '#corpus';
import { isPdfSpecimen, sample } from '#corpus';

const label = (over: Partial<BenchLabel>): BenchLabel => ({
  id: 'x',
  source: 'web',
  file: 'x.png',
  path: '/x.png',
  carrier: 'usps',
  tracking: null,
  recipient: null,
  sender: null,
  pieces: null,
  weightKg: null,
  difficulties: [],
  reviewed: false,
  ...over,
});

const pdf = {
  url: 'https://example.org/guide.pdf',
  page: 'https://example.org/',
  sha1: '0'.repeat(40),
  license: 'droits réservés',
  author: 'transporteur',
  pdf: { page: 1, crop: { left: 0, top: 0, width: 0.5, height: 0.5 } },
};

describe('isPdfSpecimen', () => {
  it('flags only the 105 ppi guides of Colissimo and DPD', () => {
    expect(isPdfSpecimen(label({ carrier: 'colissimo', origin: pdf }))).toBe(
      true,
    );
    expect(isPdfSpecimen(label({ carrier: 'dpd', origin: pdf }))).toBe(true);
    expect(isPdfSpecimen(label({ carrier: 'usps', origin: pdf }))).toBe(false);
    expect(
      isPdfSpecimen(
        label({ carrier: 'dpd', origin: { ...pdf, pdf: undefined } }),
      ),
    ).toBe(false);
    expect(isPdfSpecimen(label({ carrier: 'dpd', source: 'real' }))).toBe(
      false,
    );
  });
});

describe('sample', () => {
  it('spreads the limit over the whole list and keeps everything otherwise', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(sample(items, 4)).toEqual([0, 3, 5, 8]);
    expect(sample(items, null)).toEqual(items);
    expect(sample(items, 20)).toEqual(items);
  });
});
