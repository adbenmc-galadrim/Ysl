const digitsOf = (value: string) => [...value].map(Number);

const mod10Complement = (sum: number) => String((10 - (sum % 10)) % 10);

export const upsCheck = (body: string) => {
  const sum = [...body].reduce((acc, char, i) => {
    const value = /\d/.test(char)
      ? Number(char)
      : (char.charCodeAt(0) - 63) % 10;
    return acc + (i % 2 === 1 ? value * 2 : value);
  }, 0);
  return mod10Complement(sum);
};

export const fedexCheck = (body: string) => {
  const weights = [3, 1, 7];
  const sum = digitsOf(body).reduce(
    (acc, digit, i) => acc + digit * weights[i % 3]!,
    0,
  );
  return String((sum % 11) % 10);
};

export const gs1Check = (body: string) => {
  const digits = digitsOf(body);
  const sum = digits.reduce(
    (acc, digit, i) => acc + digit * ((digits.length - i) % 2 === 1 ? 3 : 1),
    0,
  );
  return mod10Complement(sum);
};

export const dhlCheck = (body: string) => String(Number(body) % 7);

export const s10Check = (body: string) => {
  const weights = [8, 6, 4, 2, 3, 5, 9, 7];
  const sum = digitsOf(body).reduce(
    (acc, digit, i) => acc + digit * weights[i]!,
    0,
  );
  const check = 11 - (sum % 11);
  return String(check === 10 ? 0 : check === 11 ? 5 : check);
};

const MOD_37_36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*';

export const dpdCheck = (body: string) => {
  const product = [...body].reduce((acc, char) => {
    const sum = ((acc === 0 ? 36 : acc) + MOD_37_36.indexOf(char)) % 36;
    return ((sum === 0 ? 36 : sum) * 2) % 37;
  }, 36);
  return MOD_37_36[(37 - product) % 36]!;
};
