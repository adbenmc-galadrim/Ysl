import { describe, expect, it } from 'vitest';
import { seeded } from '#random';
import {
  colissimoCheck,
  dhlCheck,
  dpdCheck,
  fedexCheck,
  s10Check,
  trackingFor,
  upsCheck,
} from '#tracking';

describe('check digits on the examples of §4.6', () => {
  it.each([
    ['UPS', '1ZE6344W0499230622', (v: string) => upsCheck(v.slice(2, -1))],
    ['FedEx', '877974873338', (v: string) => fedexCheck(v.slice(0, -1))],
    ['DHL', '5413337112', (v: string) => dhlCheck(v.slice(0, -1))],
    [
      'Colissimo',
      '8J02299079750',
      (v: string) => colissimoCheck(v.slice(2, -1)),
    ],
  ])('%s %s', (_, value, check) => {
    expect(check(value)).toBe(value.at(-1));
  });

  it('DPD 10464000209404, printed Y on the real label', () => {
    expect(dpdCheck('10464000209404')).toBe('Y');
  });

  it('rejects the false FedEx 7185713569 as DHL', () => {
    expect(dhlCheck('718571356')).not.toBe('9');
  });

  it.each(['986578788855', '794808390594'])('FedEx guide %s', (value) => {
    expect(fedexCheck(value.slice(0, -1))).toBe(value.at(-1));
  });

  it('S10 RR473124829GB', () => {
    expect(s10Check('47312482')).toBe('9');
  });
});

describe('generated trackings', () => {
  const r = seeded(42);
  const validators = {
    ups: (v: string) => upsCheck(v.slice(2, -1)) === v.at(-1),
    fedex: (v: string) => fedexCheck(v.slice(0, -1)) === v.at(-1),
    'dhl-express': (v: string) => dhlCheck(v.slice(0, -1)) === v.at(-1),
    colissimo: (v: string) => colissimoCheck(v.slice(2, -1)) === v.at(-1),
    tnt: (v: string) => s10Check(v.slice(0, -1)) === v.at(-1),
    s10: (v: string) => s10Check(v.slice(2, 10)) === v.at(-3),
  };

  it.each(Object.entries(validators))(
    '%s pass their own check digit',
    (carrier, valid) => {
      const generate = trackingFor[carrier as keyof typeof validators];
      for (let i = 0; i < 200; i++) {
        expect(valid(generate(r).value)).toBe(true);
      }
    },
  );

  it('DPD prints the check character after the 14 digits', () => {
    const { value, printed } = trackingFor.dpd(r);
    expect(printed.replaceAll(' ', '')).toBe(`${value}${dpdCheck(value)}`);
  });

  it('the same seed gives the same trackings', () => {
    expect(trackingFor.ups(seeded(7))).toEqual(trackingFor.ups(seeded(7)));
  });
});
