import {
  dhlCheck,
  dpdCheck,
  fedexCheck,
  gs1Check,
  s10Check,
  upsCheck,
} from '@repo/contract/tracking';
import type { Random } from '#random';

export type Tracking = { value: string; printed: string };

export const trackingFor = {
  ups: (r: Random): Tracking => {
    const body = `${r.letters(1)}${r.digits(1)}${r.letters(1)}${r.digits(3)}${r.pick(['01', '03', '12', '13', '66'])}${r.digits(7)}`;
    const value = `1Z${body}${upsCheck(body)}`;
    return {
      value,
      printed: `1Z ${body.slice(0, 6)} ${body.slice(6, 8)} ${body.slice(8, 12)} ${body.slice(12)}${value.at(-1)}`,
    };
  },
  fedex: (r: Random): Tracking => {
    const body = `7${r.digits(10)}`;
    const value = `${body}${fedexCheck(body)}`;
    return {
      value,
      printed: `${value.slice(0, 4)} ${value.slice(4, 8)} ${value.slice(8)}`,
    };
  },
  'dhl-express': (r: Random): Tracking => {
    const body = `${r.int(1, 9)}${r.digits(8)}`;
    const value = `${body}${dhlCheck(body)}`;
    return {
      value,
      printed: `${value.slice(0, 2)} ${value.slice(2, 6)} ${value.slice(6)}`,
    };
  },
  colissimo: (r: Random): Tracking => {
    const body = r.digits(10);
    const value = `${r.pick(['6A', '6C', '8J', '8L', '8R'])}${body}${gs1Check(body)}`;
    return {
      value,
      printed: `${value.slice(0, 2)} ${value.slice(2, 5)} ${value.slice(5, 8)} ${value.slice(8, 11)} ${value.slice(11)}`,
    };
  },
  chronopost: (r: Random): Tracking => {
    const value = `${r.pick(['XA', 'XB', 'XY', 'HA', 'EE'])}${r.digits(9)}FR`;
    return { value, printed: value };
  },
  'la-poste': (r: Random): Tracking => {
    const value = `${r.int(1, 9)}${r.pick(['K', 'L', 'R'])}${r.digits(11)}`;
    return {
      value,
      printed: `${value.slice(0, 2)} ${value.slice(2, 7)} ${value.slice(7)}`,
    };
  },
  dpd: (r: Random): Tracking => {
    const value = `${r.pick(['0', '1'])}${r.digits(13)}`;
    return {
      value,
      printed: `${value.slice(0, 4)} ${value.slice(4, 8)} ${value.slice(8, 12)} ${value.slice(12)} ${dpdCheck(value)}`,
    };
  },
  gls: (r: Random): Tracking => {
    const value = `${r.int(1, 9)}${r.digits(11)}`;
    return { value, printed: value };
  },
  tnt: (r: Random): Tracking => {
    const body = r.digits(8);
    const value = `${body}${s10Check(body)}`;
    return { value, printed: value };
  },
  s10: (r: Random): Tracking => {
    const body = r.digits(8);
    const value = `${r.pick(['RR', 'LX', 'CP', 'EE'])}${body}${s10Check(body)}${r.pick(['DE', 'IT', 'GB', 'ES'])}`;
    return { value, printed: value };
  },
};
