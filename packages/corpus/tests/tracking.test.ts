import { describe, expect, it } from 'vitest';
import {
  dpdCheck,
  type TrackingContext,
  validateTracking,
} from '@repo/contract/tracking';
import { seeded } from '#random';
import { trackingFor } from '#tracking';

describe('generated trackings', () => {
  const r = seeded(42);
  const contexts = {
    ups: 'ups',
    fedex: 'fedex',
    'dhl-express': 'dhl-express',
    colissimo: 'colissimo',
    chronopost: 'chronopost',
    'la-poste': 'la-poste',
    dpd: 'dpd',
    gls: 'gls',
    tnt: 'tnt',
    s10: 'la-poste',
  } satisfies Record<keyof typeof trackingFor, TrackingContext>;

  it.each(Object.entries(contexts))(
    '%s are sure for the contract with their carrier as context',
    (carrier, context) => {
      const generate = trackingFor[carrier as keyof typeof trackingFor];
      for (let i = 0; i < 200; i++) {
        const { value } = generate(r);
        expect(validateTracking(value, { context }).status, value).toBe('sure');
      }
    },
  );

  it.each(['ups', 'fedex', 'colissimo', 's10'] as const)(
    '%s are sure without any context',
    (carrier) => {
      for (let i = 0; i < 50; i++) {
        const { value } = trackingFor[carrier](r);
        expect(validateTracking(value).status, value).toBe('sure');
      }
    },
  );

  it('DPD prints the check character after the 14 digits', () => {
    const { value, printed } = trackingFor.dpd(r);
    expect(printed.replaceAll(' ', '')).toBe(`${value}${dpdCheck(value)}`);
    expect(validateTracking(printed).status).toBe('sure');
  });

  it('the same seed gives the same trackings', () => {
    expect(trackingFor.ups(seeded(7))).toEqual(trackingFor.ups(seeded(7)));
  });
});
