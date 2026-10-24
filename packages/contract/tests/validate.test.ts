import { describe, expect, it } from 'vitest';
import {
  type TrackingContext,
  validateTracking,
} from '@repo/contract/tracking';

const verdict = (raw: string, context?: TrackingContext) => {
  const v = validateTracking(raw, { context });
  return `${v.status} ${v.carrier ?? '-'} ${v.reason}`;
};

describe('non-regression cases of §4.6', () => {
  it.each([
    ['1ZE6344W0499230622', undefined, 'sure ups valid-key'],
    ['877974873338', undefined, 'sure fedex valid-key'],
    ['5413337112', 'dhl-express', 'sure dhl-express valid-key'],
    ['5413337112', undefined, 'to-verify dhl-express needs-context'],
    ['8J02299079750', undefined, 'sure colissimo valid-key'],
    ['HA915306631JB', 'chronopost', 'sure chronopost format-and-context'],
    ['HA915306631JB', undefined, 'to-verify chronopost needs-context'],
    ['10464000209404', 'dpd', 'sure dpd format-and-context'],
    ['10464000209404', undefined, 'to-verify - ambiguous'],
    ['10464000209404Y', undefined, 'sure dpd valid-key'],
    ['7185713569', undefined, 'rejected dhl-express invalid-key'],
    ['7185713569', 'dhl-express', 'rejected dhl-express invalid-key'],
    ['7185713569', 'fedex', 'rejected - context-mismatch'],
  ] as const)('%s with context %s → %s', (raw, context, expected) => {
    expect(verdict(raw, context)).toBe(expected);
  });

  it('never returns sure for 7185713569, whatever the context', () => {
    for (const context of [
      undefined,
      'fedex',
      'dhl-express',
      'other',
    ] as const) {
      expect(validateTracking('7185713569', { context }).status).not.toBe(
        'sure',
      );
    }
  });
});

describe('rules of the v1 that must stay out', () => {
  it('does not accept 8701 + 8 digits without the FedEx key', () => {
    const v = validateTracking('870112345678');
    expect(v.status).toBe('to-verify');
    expect(v.carrier).not.toBe('fedex');
    expect(verdict('870112345678', 'fedex')).toBe('rejected fedex invalid-key');
  });

  it('does not take 13 digits for a Colissimo', () => {
    expect(validateTracking('6012097809701').carrier).not.toBe('colissimo');
    expect(validateTracking('6012097809701').status).toBe('rejected');
  });

  it.each(['1234567890', '123456789013', '12345', 'ABCDEFGHIJKLM'])(
    'never trusts an arbitrary number such as %s',
    (raw) => {
      expect(validateTracking(raw).status).not.toBe('sure');
    },
  );

  it('a wrong key is never sure, even with the right context', () => {
    expect(verdict('1ZE6344W0499230623', 'ups')).toBe(
      'rejected ups invalid-key',
    );
    expect(verdict('8J02299079751', 'colissimo')).toBe(
      'rejected colissimo invalid-key',
    );
    expect(verdict('RR473124828GB', 'la-poste')).toBe(
      'rejected la-poste invalid-key',
    );
  });
});

describe('formats of §4.6 beyond the non-regression table', () => {
  it.each([
    ['9611020987654312345672', undefined, 'sure fedex valid-key'],
    ['RR473124829GB', undefined, 'sure - valid-key'],
    ['RR473124829GB', 'deutsche-post', 'sure deutsche-post valid-key'],
    ['EY946052074FR', 'colissimo', 'sure colissimo valid-key'],
    ['00340434122150000874', undefined, 'sure - valid-key'],
    ['00340434122150000874', 'dhl-paket', 'sure dhl-paket valid-key'],
    ['00340434122150000875', undefined, 'rejected - invalid-key'],
    ['3Y00432154789', undefined, 'to-verify la-poste needs-context'],
    ['3Y00432154789', 'la-poste', 'sure la-poste format-and-context'],
    ['12345678901234', 'la-poste', 'sure la-poste format-and-context'],
    ['851411485585', 'gls', 'sure gls format-and-context'],
    ['851411485585', undefined, 'to-verify gls needs-context'],
    ['473124829', 'tnt', 'sure tnt valid-key'],
    ['473124829', undefined, 'to-verify tnt needs-context'],
    ['473124828', 'tnt', 'to-verify tnt invalid-key'],
    ['473124828', undefined, 'to-verify tnt invalid-key'],
    ['123456789012345', undefined, 'rejected - invalid-key'],
    ['123456789012343', undefined, 'sure fedex valid-key'],
    ['GE473124829WW', 'tnt', 'sure tnt format-and-context'],
    ['GE473124828WW', undefined, 'to-verify - ambiguous'],
    ['AL0127225853', 'amazon', 'to-verify - unknown-format'],
    ['AL0127225853', undefined, 'rejected - unknown-format'],
    ['', 'ups', 'rejected - empty'],
  ] as const)('%s with context %s → %s', (raw, context, expected) => {
    expect(verdict(raw, context)).toBe(expected);
  });
});

describe('ties between carriers sharing a format', () => {
  it('prefers the Colissimo key to the La Poste format', () => {
    expect(verdict('6A12097809701')).toBe('sure colissimo valid-key');
  });

  it('falls back to La Poste when the Colissimo key fails', () => {
    expect(verdict('6A12097809702')).toBe('to-verify la-poste needs-context');
    expect(verdict('6A12097809702', 'la-poste')).toBe(
      'sure la-poste format-and-context',
    );
  });

  it('lets the Chronopost context win over the S10 key', () => {
    expect(verdict('RR473124829GB', 'chronopost')).toBe(
      'sure chronopost format-and-context',
    );
    expect(verdict('XY123456785FR')).toBe('sure - valid-key');
  });

  it('caps a FedEx key read on a Colissimo label at to-verify', () => {
    expect(verdict('393711491718')).toBe('sure fedex valid-key');
    expect(verdict('393711491718', 'colissimo')).toBe(
      'to-verify - context-mismatch',
    );
  });

  it('does not trust 15 digits that pass both the FedEx and DPD keys', () => {
    expect(verdict('100000005487867')).toBe('to-verify - ambiguous');
    expect(verdict('100000005487867', 'dpd')).toBe('sure dpd valid-key');
    expect(verdict('100000005487867', 'fedex')).toBe('sure fedex valid-key');
  });

  it('lets the context pick the carrier among equal formats', () => {
    expect(verdict('01925003752046', 'dpd')).toBe(
      'sure dpd format-and-context',
    );
    expect(verdict('01925003752046', 'hermes')).toBe(
      'to-verify - context-mismatch',
    );
    expect(verdict('01925003752046', 'la-poste')).toBe(
      'sure la-poste format-and-context',
    );
  });
});

describe('normalisation and extras', () => {
  it.each([
    '1Z E6344W 04 9923 0622',
    '1ze6344w0499230622',
    '1Z-E6344W-04-9923-0622',
    ' 1Z.E6344W.04.9923.0622 ',
  ])('reads %s as the same UPS tracking', (raw) => {
    const v = validateTracking(raw);
    expect(v.value).toBe('1ZE6344W0499230622');
    expect(v.status).toBe('sure');
  });

  it('lists every candidate so a caller can vote or ask', () => {
    const { candidates } = validateTracking('10464000209404');
    expect(candidates.map((c) => `${c.carrier} ${c.status}`)).toEqual([
      'la-poste to-verify',
      'dpd to-verify',
    ]);
    expect(validateTracking('6A12097809701').candidates).toEqual([
      expect.objectContaining({ carrier: 'colissimo', status: 'sure' }),
      expect.objectContaining({ carrier: 'la-poste', status: 'to-verify' }),
    ]);
    expect(validateTracking('AL0127225853').candidates).toEqual([]);
  });

  it('exposes the UPS and FedEx Ground shipper accounts', () => {
    expect(validateTracking('1ZE6344W0499230622').shipperAccount).toBe(
      'E6344W',
    );
    expect(validateTracking('9611020987654312345672').shipperAccount).toBe(
      '9876543',
    );
    expect(validateTracking('123456789012343').shipperAccount).toBe('1234567');
    expect(validateTracking('877974873338')).not.toHaveProperty(
      'shipperAccount',
    );
  });
});
