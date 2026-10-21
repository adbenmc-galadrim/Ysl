import { describe, expect, it } from 'vitest';
import { coverage } from '#coverage';
import { labelSchema, type Carrier, type Label } from '#schema';

const label = (id: number, carrier: Carrier): Label => ({
  id: `l-${id}`,
  source: 'synthetic',
  file: `${id}.jpg`,
  carrier,
  tracking: null,
  recipient: null,
  sender: null,
  pieces: null,
  weightKg: null,
  difficulties: [],
  reviewed: true,
});

const corpus = (perCarrier: number, carriers: Carrier[]) =>
  carriers.flatMap((carrier, c) =>
    Array.from({ length: perCarrier }, (_, i) =>
      label(c * perCarrier + i, carrier),
    ),
  );

const six: Carrier[] = [
  'colissimo',
  'chronopost',
  'ups',
  'dpd',
  'gls',
  'fedex',
];

describe('coverage', () => {
  it('accepts 102 labels spread over 6 carriers', () => {
    expect(coverage(corpus(17, six)).problems).toEqual([]);
  });

  it('refuses 99 labels', () => {
    expect(coverage(corpus(33, six.slice(0, 3))).problems).toContain(
      '99 étiquettes, il en faut 100',
    );
  });

  it('refuses a corpus where only 5 carriers reach 10 labels', () => {
    const labels = [
      ...corpus(20, six.slice(0, 5)),
      ...corpus(9, ['tnt']).map((l) => ({ ...l, id: `tnt-${l.id}` })),
    ];
    expect(coverage(labels).problems).toEqual([
      '5 transporteurs à 10 étiquettes ou plus, il en faut 6',
    ]);
  });

  it('does not count "other" as a carrier', () => {
    const labels = [
      ...corpus(20, six.slice(0, 5)),
      ...corpus(20, ['other']).map((l) => ({ ...l, id: `o-${l.id}` })),
    ];
    expect(coverage(labels).problems).toHaveLength(1);
  });

  it('refuses duplicated ids', () => {
    const labels = corpus(17, six);
    expect(coverage([...labels, labels[0]!]).problems[0]).toMatch(/double/);
  });
});

describe('labelSchema', () => {
  it('refuses a web label without its source and license', () => {
    expect(
      labelSchema.safeParse({ ...label(1, 'dhl-paket'), source: 'web' })
        .success,
    ).toBe(false);
  });

  it('refuses n/N where n exceeds N', () => {
    expect(
      labelSchema.safeParse({
        ...label(1, 'ups'),
        pieces: { index: 3, total: 2 },
      }).success,
    ).toBe(false);
  });
});
