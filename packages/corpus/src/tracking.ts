import type { Random } from '#random';

const toDigits = (value: string) => [...value].map(Number);

export const upsCheck = (body: string) => {
  const sum = [...body].reduce((acc, char, i) => {
    const value = /\d/.test(char)
      ? Number(char)
      : (char.charCodeAt(0) - 63) % 10;
    return acc + (i % 2 === 1 ? value * 2 : value);
  }, 0);
  return String((10 - (sum % 10)) % 10);
};

export const fedexCheck = (body: string) => {
  const weights = [3, 1, 7];
  const sum = toDigits(body).reduce(
    (acc, digit, i) => acc + digit * weights[i % 3]!,
    0,
  );
  return String((sum % 11) % 10);
};

export const dhlCheck = (body: string) => String(Number(body) % 7);

export const colissimoCheck = (body: string) => {
  const sum = toDigits(body).reduce(
    (acc, digit, i) => acc + digit * (i % 2 === 0 ? 1 : 3),
    0,
  );
  return String((10 - (sum % 10)) % 10);
};

export const s10Check = (body: string) => {
  const weights = [8, 6, 4, 2, 3, 5, 9, 7];
  const sum = toDigits(body).reduce(
    (acc, digit, i) => acc + digit * weights[i]!,
    0,
  );
  const check = 11 - (sum % 11);
  return String(check === 10 ? 0 : check === 11 ? 5 : check);
};

const mod3736 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*';

export const dpdCheck = (body: string) => {
  const product = [...body].reduce((acc, char) => {
    const sum = ((acc === 0 ? 36 : acc) + mod3736.indexOf(char)) % 36;
    return ((sum === 0 ? 36 : sum) * 2) % 37;
  }, 36);
  return mod3736[(37 - product) % 36]!;
};

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
    const value = `${r.pick(['6A', '6C', '8J', '8L', '8R'])}${body}${colissimoCheck(body)}`;
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
