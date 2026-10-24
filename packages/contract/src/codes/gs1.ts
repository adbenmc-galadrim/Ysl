import type { BarcodeTracking } from '../tracking/barcode';
import type { TrackingContext } from '../tracking/rules';
import {
  country,
  GS,
  party,
  phone,
  postalCode,
  poundsToKg,
  text,
} from './fields';
import type { ParsedCode, Party } from './types';

const FIXED_LENGTH: Record<string, number> = {
  '00': 18,
  '01': 14,
  '02': 14,
  '03': 14,
  '11': 6,
  '12': 6,
  '13': 6,
  '15': 6,
  '16': 6,
  '17': 6,
  '18': 6,
  '19': 6,
  '20': 2,
  '31': 6,
  '32': 6,
  '33': 6,
  '34': 6,
  '35': 6,
  '36': 6,
  '41': 13,
};

const AI_LENGTH: Record<string, number> = {
  '23': 3,
  '24': 3,
  '25': 3,
  '31': 4,
  '32': 4,
  '33': 4,
  '34': 4,
  '35': 4,
  '36': 4,
  '39': 4,
  '40': 3,
  '41': 3,
  '42': 3,
  '43': 4,
  '70': 4,
  '71': 3,
  '72': 4,
  '80': 4,
  '81': 4,
  '82': 4,
};

const SYMBOLOGY_PREFIX = /^\](?:C1|d2|Q3|e0|J1)/;

export type Gs1Elements = Map<string, string>;

const withSeparators = (raw: string): string => {
  const bare = raw.replace(SYMBOLOGY_PREFIX, '');
  if (!/^\(\d{2,4}\)/.test(bare)) return bare;
  return bare
    .replace(/\((\d{2,4})\)/g, (_, ai: string) => `${GS}${ai}`)
    .slice(1);
};

export const splitGs1 = (raw: string): Gs1Elements => {
  const elements: Gs1Elements = new Map();
  let rest = withSeparators(raw);
  while (rest !== '') {
    if (rest.startsWith(GS)) {
      rest = rest.slice(1);
      continue;
    }
    const prefix = rest.slice(0, 2);
    const aiLength = AI_LENGTH[prefix] ?? 2;
    const ai = rest.slice(0, aiLength);
    if (!/^\d+$/.test(ai) || ai.length < aiLength) break;
    const fixed = FIXED_LENGTH[prefix];
    const start = aiLength;
    let value: string;
    if (fixed !== undefined) {
      value = rest.slice(start, start + fixed);
      if (value.length < fixed) break;
      rest = rest.slice(start + fixed);
    } else {
      const end = rest.indexOf(GS, start);
      value = end === -1 ? rest.slice(start) : rest.slice(start, end);
      rest = end === -1 ? '' : rest.slice(end + 1);
    }
    if (value !== '') elements.set(ai, value);
  }
  return elements;
};

const decimal = (ai: string, value: string | undefined): number | undefined => {
  if (value === undefined || !/^\d{6}$/.test(value)) return undefined;
  const amount = Number(value) / 10 ** Number(ai.at(-1));
  return amount > 0 ? amount : undefined;
};

const weightOf = (elements: Gs1Elements): number | undefined => {
  for (const [ai, value] of elements) {
    if (/^3[13]0\d$/.test(ai)) return decimal(ai, value);
  }
  for (const [ai, value] of elements) {
    if (/^3[24]0\d$/.test(ai)) {
      const pounds = decimal(ai, value);
      return pounds === undefined ? undefined : poundsToKg(pounds);
    }
  }
  return undefined;
};

const partyOf = (elements: Gs1Elements, base: string): Party | undefined =>
  party({
    company: text(elements.get(`${base}0`)),
    name: text(elements.get(`${base}1`)),
    street: text(
      [elements.get(`${base}2`), elements.get(`${base}3`)]
        .filter((part) => part !== undefined)
        .join(' '),
    ),
    city: text(elements.get(`${base}5`)),
    region: text(elements.get(`${base}6`)),
    country: country(elements.get(`${base}7`)),
    phone: phone(elements.get(`${base}8`)),
  });

const shipTo = (elements: Gs1Elements): Party | undefined => {
  const base = partyOf(elements, '430') ?? {};
  const shipToPostal = elements.get('420');
  const withCountry = elements.get('421');
  const postal = postalCode(
    shipToPostal ??
      (withCountry === undefined ? undefined : withCountry.slice(3)),
  );
  const countryCode =
    base.country ??
    (withCountry === undefined ? undefined : country(withCountry.slice(0, 3)));
  return party({
    ...base,
    ...(postal === undefined ? {} : { postalCode: postal }),
    ...(countryCode === undefined ? {} : { country: countryCode }),
  });
};

const trackingsOf = (
  elements: Gs1Elements,
): { trackings: BarcodeTracking[]; carrier: TrackingContext | null } => {
  const trackings: BarcodeTracking[] = [];
  let carrier: TrackingContext | null = null;
  const sscc = elements.get('00');
  if (sscc !== undefined) trackings.push({ value: `00${sscc}` });
  if (elements.has('420')) {
    for (const ai of ['92', '93', '94', '95']) {
      const value = elements.get(ai);
      if (value !== undefined && /^\d{20}$/.test(value)) {
        trackings.push({ value: `${ai}${value}`, context: 'usps' });
        carrier = 'usps';
      }
    }
  }
  return { trackings, carrier };
};

const FIXED_LEAD = /^(?:00\d{18}|0[123]\d{14})/;

export const looksLikeGs1 = (raw: string): boolean => {
  const bare = raw.replace(SYMBOLOGY_PREFIX, '');
  return (
    bare !== raw ||
    /^\(\d{2,4}\)/.test(bare) ||
    bare.includes(GS) ||
    FIXED_LEAD.test(bare)
  );
};

export const parseGs1 = (raw: string): ParsedCode | null => {
  if (!looksLikeGs1(raw)) return null;
  const elements = splitGs1(raw);
  if (elements.size === 0) return null;
  const { trackings, carrier } = trackingsOf(elements);
  const recipient = shipTo(elements);
  const sender = partyOf(elements, '431');
  const weightKg = weightOf(elements);
  const reference = elements.get('401') ?? elements.get('402');
  return {
    scheme: 'gs1',
    carrier,
    trackings,
    ...(recipient === undefined ? {} : { recipient }),
    ...(sender === undefined ? {} : { sender }),
    ...(weightKg === undefined ? {} : { weightKg }),
    ...(reference === undefined ? {} : { reference }),
    fields: Object.fromEntries(elements),
  };
};
