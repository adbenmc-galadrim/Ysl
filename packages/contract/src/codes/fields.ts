import type { Party, Pieces } from './types';

export const GS = '\u001d';
export const RS = '\u001e';
export const US = '\u001f';
export const EOT = '\u0004';

const NUMERIC_COUNTRIES: Record<string, string> = {
  '012': 'DZ',
  '036': 'AU',
  '040': 'AT',
  '056': 'BE',
  '076': 'BR',
  '100': 'BG',
  '124': 'CA',
  '156': 'CN',
  '158': 'TW',
  '191': 'HR',
  '196': 'CY',
  '203': 'CZ',
  '208': 'DK',
  '233': 'EE',
  '246': 'FI',
  '250': 'FR',
  '276': 'DE',
  '300': 'GR',
  '344': 'HK',
  '348': 'HU',
  '356': 'IN',
  '360': 'ID',
  '372': 'IE',
  '376': 'IL',
  '380': 'IT',
  '392': 'JP',
  '410': 'KR',
  '428': 'LV',
  '440': 'LT',
  '442': 'LU',
  '458': 'MY',
  '470': 'MT',
  '484': 'MX',
  '492': 'MC',
  '504': 'MA',
  '528': 'NL',
  '554': 'NZ',
  '578': 'NO',
  '608': 'PH',
  '616': 'PL',
  '620': 'PT',
  '642': 'RO',
  '643': 'RU',
  '702': 'SG',
  '703': 'SK',
  '705': 'SI',
  '710': 'ZA',
  '724': 'ES',
  '752': 'SE',
  '756': 'CH',
  '764': 'TH',
  '784': 'AE',
  '788': 'TN',
  '792': 'TR',
  '804': 'UA',
  '826': 'GB',
  '840': 'US',
};

const LB_IN_KG = 0.45359237;

export const poundsToKg = (pounds: number): number =>
  Math.round(pounds * LB_IN_KG * 1000) / 1000;

export const country = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined;
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return NUMERIC_COUNTRIES[raw];
};

export const postalCode = (raw: string | undefined): string | undefined => {
  if (raw === undefined || !/^\d{4,9}$/.test(raw)) return undefined;
  return /^00\d{5}$/.test(raw) ? raw.slice(2) : raw;
};

export const pieces = (raw: string | undefined): Pieces | undefined => {
  const match = raw === undefined ? null : /^(\d+)\/(\d+)$/.exec(raw);
  if (!match) return undefined;
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (index < 1 || total < 1 || index > total) return undefined;
  return { index, total };
};

export const weightKg = (
  raw: string | undefined,
  defaultUnit: 'KG' | 'LB' = 'KG',
): number | undefined => {
  const match =
    raw === undefined ? null : /^(\d+(?:[.,]\d+)?)\s*(KGS?|LBS?)?$/.exec(raw);
  if (!match) return undefined;
  const amount = Number(match[1]!.replace(',', '.'));
  if (!(amount > 0)) return undefined;
  const unit = match[2]?.startsWith('LB')
    ? 'LB'
    : match[2]
      ? 'KG'
      : defaultUnit;
  return unit === 'LB' ? poundsToKg(amount) : Math.round(amount * 1000) / 1000;
};

export const phone = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined;
  const compact = raw.replace(/[\s().-]/g, '');
  return /^\+?\d{9,15}$/.test(compact) ? compact : undefined;
};

export const text = (raw: string | undefined): string | undefined => {
  const value = raw?.trim();
  return value ? value : undefined;
};

export const party = (candidate: Party): Party | undefined => {
  const entries = Object.entries(candidate).filter(
    ([, value]) => value !== undefined,
  );
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
};
