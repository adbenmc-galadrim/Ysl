import { describe, expect, it } from 'vitest';
import {
  dhlCheck,
  dpdCheck,
  fedexCheck,
  gs1Check,
  s10Check,
  upsCheck,
} from '@repo/contract/tracking';

describe('check digits on the examples of §4.6 and report 03', () => {
  it.each([
    ['UPS', '1ZE6344W0499230622', (v: string) => upsCheck(v.slice(2, -1))],
    ['UPS', '1Z410E1W0214647438', (v: string) => upsCheck(v.slice(2, -1))],
    ['FedEx', '877974873338', (v: string) => fedexCheck(v.slice(0, -1))],
    ['FedEx', '986578788855', (v: string) => fedexCheck(v.slice(0, -1))],
    ['FedEx', '794808390594', (v: string) => fedexCheck(v.slice(0, -1))],
    ['DHL', '5413337112', (v: string) => dhlCheck(v.slice(0, -1))],
    ['DHL', '7708192660', (v: string) => dhlCheck(v.slice(0, -1))],
    ['Colissimo', '8J02299079750', (v: string) => gs1Check(v.slice(2, -1))],
    ['Colissimo', '9V00001481952', (v: string) => gs1Check(v.slice(2, -1))],
    [
      'FedEx Ground 96',
      '9611020987654312345672',
      (v: string) => gs1Check(v.slice(7, -1)),
    ],
    ['SSCC', '00340434122150000874', (v: string) => gs1Check(v.slice(2, -1))],
    ['SSCC', '00340434764338651562', (v: string) => gs1Check(v.slice(2, -1))],
  ])('%s %s', (_, value, check) => {
    expect(check(value)).toBe(value.at(-1));
  });

  it.each(['RR473124829GB', 'RB123456785GB'])('S10 %s', (value) => {
    expect(s10Check(value.slice(2, 10))).toBe(value[10]);
  });

  it.each([
    '6A12097809701',
    '6M12728292896',
    '6G56659126882',
    '6V00000005197',
    '6C14506243878',
    '6C14507771554',
    '8R41995579485',
  ])('Colissimo specimen %s from the official documentation', (value) => {
    expect(gs1Check(value.slice(2, -1))).toBe(value.at(-1));
  });

  it('S10 maps a remainder of 10 to 0 and of 11 to 5', () => {
    expect(s10Check('00000001')).toBe('4');
    expect(s10Check('00000000')).toBe('5');
    expect(s10Check('10100000')).toBe('0');
  });

  it('DPD follows ISO 7064 MOD 37,36 on the specification tests', () => {
    expect(dpdCheck('123AB')).toBe('X');
    expect(dpdCheck('ABC987')).toBe('E');
    expect(dpdCheck('10464000209404')).toBe('Y');
  });

  it('rejects the false FedEx 7185713569 as DHL', () => {
    expect(dhlCheck('718571356')).not.toBe('9');
  });

  it('S10 fails on the Chronopost HA915306631JB, as recorded in §4.6', () => {
    expect(s10Check('91530663')).toBe('5');
  });
});
