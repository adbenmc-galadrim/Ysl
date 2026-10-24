import { describe, expect, it } from 'vitest';
import { parseGs1, splitGs1 } from '@repo/contract/codes';
import { validateTracking } from '@repo/contract/tracking';

const GS = '\u001d';

describe('GS1 element strings', () => {
  it('splits fixed-length and GS-terminated variable elements', () => {
    const elements = splitGs1(
      `00340434122150000874${'3302000500'}10ABC12${GS}21XYZ${GS}710NTIN${GS}37012`,
    );
    expect([...elements]).toEqual([
      ['00', '340434122150000874'],
      ['3302', '000500'],
      ['10', 'ABC12'],
      ['21', 'XYZ'],
      ['710', 'NTIN'],
      ['37', '012'],
    ]);
  });

  it('accepts the human-readable form with parentheses', () => {
    expect([
      ...splitGs1('(00)340434122150000874(02)14001234567890(37)12'),
    ]).toEqual([
      ['00', '340434122150000874'],
      ['02', '14001234567890'],
      ['37', '12'],
    ]);
  });

  it('strips the symbology identifier', () => {
    expect(splitGs1(']C100340434122150000874').get('00')).toBe(
      '340434122150000874',
    );
  });

  it('stops cleanly on an unknown or truncated element and keeps what precedes', () => {
    expect([...splitGs1('003404341221500008')]).toEqual([]);
    expect([...splitGs1(`10LOT${GS}ZZ`)]).toEqual([['10', 'LOT']]);
  });
});

describe('GS1 codes mapped to the parcel', () => {
  it('reads the SSCC as the parcel identifier', () => {
    const code = parseGs1('(00)340434122150000874(02)14001234567890');
    expect(code).toMatchObject({
      scheme: 'gs1',
      carrier: null,
      trackings: [{ value: '00340434122150000874' }],
    });
    expect(validateTracking(code!.trackings[0]!.value).status).toBe('sure');
  });

  it('reads the gross weight and the ship-to party', () => {
    const code = parseGs1(
      `00340434122150000874${'3302000500'}42075007${GS}4300ACME${GS}4301CAMILLE MOREL${GS}430224 RUE DE L UNIVERSITE${GS}4305PARIS${GS}4307FR${GS}4308+33612345678${GS}4310SENDER SAS${GS}4317DE`,
    );
    expect(code).toMatchObject({
      weightKg: 5,
      recipient: {
        company: 'ACME',
        name: 'CAMILLE MOREL',
        street: '24 RUE DE L UNIVERSITE',
        city: 'PARIS',
        postalCode: '75007',
        country: 'FR',
        phone: '+33612345678',
      },
      sender: { company: 'SENDER SAS', country: 'DE' },
    });
  });

  it('converts a pound weight and reads the postal code with its country', () => {
    const code = parseGs1(`3401000220${GS}42125075007`);
    expect(code?.weightKg).toBe(9.979);
    expect(code?.recipient).toEqual({ postalCode: '75007', country: 'FR' });
  });

  it('reads the USPS IMpb behind the postal routing', () => {
    const code = parseGs1(`42075007${GS}9400100000000000000000`);
    expect(code).toMatchObject({
      carrier: 'usps',
      trackings: [{ value: '9400100000000000000000', context: 'usps' }],
    });
  });

  it('does not take an internal AI for a tracking without the routing', () => {
    const code = parseGs1('(94)00100000000000000000');
    expect(code?.trackings).toEqual([]);
    expect(code?.carrier).toBeNull();
  });

  it('returns null on a text that is not a GS1 element string', () => {
    expect(parseGs1('HA915306631JB')).toBeNull();
    expect(parseGs1('877974873338')).toBeNull();
    expect(parseGs1('9400100000000000000000')).toBeNull();
    expect(parseGs1('')).toBeNull();
  });

  it('recognises a bare SSCC or GTIN lead as GS1', () => {
    expect(parseGs1('00340434122150000874')?.trackings).toEqual([
      { value: '00340434122150000874' },
    ]);
    expect(parseGs1('00 340434122150000874')).toBeNull();
  });
});
