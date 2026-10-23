import { describe, expect, it } from 'vitest';
import { matchTracking, recomposeUps } from '#/decode/match';

const sym = (format: string, text: string) => ({ format, text });

describe('matchTracking', () => {
  it('finds a tracking in clear inside a Code 128 with prefixes', () => {
    const m = matchTracking(
      '7388204615',
      [sym('Code128', 'JJD014600017388204615')],
      'dhl-express',
    );
    expect(m).toEqual({ status: 'read', formats: ['Code128'], rule: 'exact' });
    expect(
      matchTracking('XA123456789FR', [sym('Code128', '%0075001XA123456789FR')])
        .status,
    ).toBe('read');
  });

  it('ignores case and spaces in the tracking and the content', () => {
    const m = matchTracking('1Z AB1 2C3 04 1234 5675', [
      sym('MaxiCode', '1zab12c30412345675'),
    ]);
    expect(m.status).toBe('read');
    expect(
      matchTracking('8J00011122230', [
        sym('DataMatrix', '8j 0001 1122 230 75001'),
      ]).status,
    ).toBe('read');
  });

  it('treats GS, RS and EOT as field breaks and joins split fields', () => {
    const text =
      '[)>\u001e01\u001d96750010000\u001d250\u001d011\u001dSHORT12\u001d1ZAB12\u001dC30412345675\u0004';
    expect(
      matchTracking('1ZAB12C30412345675', [sym('MaxiCode', text)]),
    ).toEqual({ status: 'read', formats: ['MaxiCode'], rule: 'compact' });
    expect(
      matchTracking('12345678', [sym('Code128', 'AB\u001d12345678\u001eCD')])
        .rule,
    ).toBe('exact');
  });

  it('recomposes a UPS tracking from the secondary message fields', () => {
    const split =
      '[)>\u001e01\u001d96750010000\u001dFRA\u001d011\u001d0412345675\u001dUPSN\u001dAB12C3\u001d089';
    expect(recomposeUps(split)).toEqual(['1ZAB12C30412345675']);
    expect(
      matchTracking('1ZAB12C30412345675', [sym('MaxiCode', split)], 'ups'),
    ).toEqual({
      status: 'read',
      formats: ['MaxiCode'],
      rule: 'ups-recomposed',
    });
    expect(
      matchTracking('1ZAB12C30412345676', [sym('MaxiCode', split)], 'ups')
        .status,
    ).toBe('code-sans-tracking');
    expect(recomposeUps('[)>\u001d01\u001dUPSN')).toEqual([]);
  });

  it('recomposes a UPS tracking from 1Z + 8 characters and the service class', () => {
    const maxi =
      '[)>\u001e01\u001d9612345 \u001d276\u001d068\u001d1Z12345678\u001dUPSN\u001dAB12C3\u001d062\u001d\u001d1/1\u001d4\u001dN\u001d\u001dVILLE\u001d\u001e\u0004';
    expect(recomposeUps(maxi)).toEqual(['1ZAB12C36812345678']);
    expect(
      matchTracking('1ZAB12C36812345678', [sym('MaxiCode', maxi)], 'ups'),
    ).toMatchObject({ status: 'read', rule: 'ups-recomposed' });
    expect(
      matchTracking('1ZAB12C30112345678', [sym('MaxiCode', maxi)], 'ups')
        .status,
    ).toBe('code-sans-tracking');
  });

  it('reports a code without tracking, and no code', () => {
    expect(
      matchTracking('XA123456789FR', [sym('Code128', '421250750011')]),
    ).toEqual({ status: 'code-sans-tracking', formats: [], rule: null });
    expect(matchTracking(null, [sym('QRCode', 'https://x.test')]).status).toBe(
      'code-sans-tracking',
    );
    expect(matchTracking('XA123456789FR', [])).toEqual({
      status: 'aucun-code',
      formats: [],
      rule: null,
    });
  });

  it('does not count a short tracking found inside another parcel code', () => {
    expect(
      matchTracking('12345678', [sym('Code128', '991234567800')]).status,
    ).toBe('code-sans-tracking');
    expect(
      matchTracking('12345678', [sym('Code128', 'A1234567B')]).status,
    ).toBe('code-sans-tracking');
    expect(
      matchTracking('12345678', [sym('Code128', 'ID 12345678;X')]).status,
    ).toBe('read');
    expect(matchTracking('12345678', [sym('Code128', '12345678')]).status).toBe(
      'read',
    );
  });

  it('accepts a Colissimo tracking without its check digit, flagged', () => {
    const m = matchTracking(
      '8J00011122230',
      [sym('Code128', '%007500111' + '8J0001112223' + '25025')],
      'colissimo',
    );
    expect(m).toEqual({
      status: 'read',
      formats: ['Code128'],
      rule: 'without-key',
    });
    expect(
      matchTracking('8J00011122230', [sym('Code128', '8J0001112223')], 'dpd')
        .status,
    ).toBe('code-sans-tracking');
  });
});
