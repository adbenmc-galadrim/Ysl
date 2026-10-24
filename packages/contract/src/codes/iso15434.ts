import { upsCheck } from '../tracking/check-digits';
import { type BarcodeTracking, colissimoWithKey } from '../tracking/barcode';
import { normalizeTracking } from '../tracking/normalize';
import type { TrackingContext } from '../tracking/rules';
import {
  country,
  EOT,
  GS,
  party,
  phone,
  pieces,
  postalCode,
  RS,
  text,
  US,
  weightKg,
} from './fields';
import type { ParsedCode, Party } from './types';

const HEADER = `[)>${RS}`;

const TRANSPORT_FIELDS = [
  'postalCode',
  'country',
  'service',
  'trackingNumber',
  'scac',
  'shipperAccount',
  'julianDay',
  'shipmentId',
  'pieces',
  'weight',
  'addressValidation',
  'street',
  'city',
  'region',
  'name',
] as const;

type Envelope = { format: string; fields: string[] };

const envelopesOf = (text: string): Envelope[] | null => {
  if (!text.startsWith(HEADER)) return null;
  const body = text.endsWith(EOT)
    ? text.slice(HEADER.length, -1)
    : text.slice(HEADER.length);
  return body
    .split(RS)
    .filter((part) => part !== '')
    .map((part) => {
      const format = part.slice(0, 2);
      const rest = part.slice(2);
      const fields = rest.startsWith(GS)
        ? rest.slice(1).split(GS)
        : rest.split(GS);
      return { format, fields };
    });
};

const carrierOfScac = (
  scac: string | undefined,
  tracking: string | undefined,
): TrackingContext | null => {
  switch (scac) {
    case 'UPSN':
      return 'ups';
    case 'CHRO':
      return 'chronopost';
    case 'GEOP':
      if (tracking === undefined) return null;
      if (/^11\d[A-Z]\d{10}$/.test(tracking)) return 'colissimo';
      if (/^\d{14}$/.test(tracking)) return 'dpd';
      return null;
    case 'RPSB':
    case 'RPSC':
      return 'fedex';
    default:
      return scac?.startsWith('FDE') ? 'fedex' : null;
  }
};

const upsTrackings = (
  field: string,
  account: string | undefined,
  service: string | undefined,
): BarcodeTracking[] => {
  const candidates: string[] = [];
  if (/^1Z[A-Z0-9]{16}$/.test(field)) candidates.push(field);
  if (account !== undefined && /^[A-Z0-9]{6}$/.test(account)) {
    const prefixed = field.startsWith('1Z');
    const rest = prefixed ? field.slice(2) : field;
    const body = rest.startsWith(account) ? rest.slice(account.length) : rest;
    if (/^[A-Z0-9]{10}$/.test(body)) candidates.push(`1Z${account}${body}`);
    const serviceDigits = service?.match(/^\d(\d{2})$/)?.[1];
    if (prefixed && serviceDigits !== undefined && /^[A-Z0-9]{8}$/.test(body)) {
      candidates.push(`1Z${account}${serviceDigits}${body}`);
    }
  }
  return [...new Set(candidates)]
    .filter((value) => upsCheck(value.slice(2, -1)) === value.at(-1))
    .map((value) => ({ value, context: 'ups' as const }));
};

const trackingsOf = (
  carrier: TrackingContext | null,
  raw: string | undefined,
  account: string | undefined,
  service: string | undefined,
): BarcodeTracking[] => {
  const field = raw === undefined ? '' : normalizeTracking(raw);
  if (field === '') return [];
  if (carrier === 'ups') return upsTrackings(field, account, service);
  if (carrier === 'colissimo') {
    return [{ value: colissimoWithKey(field.slice(2)), context: carrier }];
  }
  if (carrier === 'fedex' && /^\d{34}$/.test(field)) {
    return [
      { value: field.slice(-12), context: carrier },
      { value: field, context: carrier },
    ];
  }
  return [
    carrier === null ? { value: field } : { value: field, context: carrier },
  ];
};

const transport = (fields: string[]): Omit<ParsedCode, 'scheme'> | null => {
  const [head = '', ...others] = fields;
  const version = /^(9\d|0\d)(.*)$/.exec(head);
  if (!version) return null;
  const sequence = version[2] === '' ? others : [version[2]!, ...others];
  const raw: Record<string, string> = { version: version[1]! };
  TRANSPORT_FIELDS.forEach((name, i) => {
    const value = sequence[i];
    if (value !== undefined && value !== '') raw[name] = value;
  });
  const carrier = carrierOfScac(raw.scac, raw.trackingNumber);
  const recipient = party({
    name: text(raw.name),
    street: text(raw.street),
    city: text(raw.city),
    region: text(raw.region),
    postalCode: postalCode(raw.postalCode),
    country: country(raw.country),
  });
  const weight = weightKg(raw.weight, carrier === 'ups' ? 'LB' : 'KG');
  const shipperAccount = text(raw.shipperAccount);
  const parsedPieces = pieces(raw.pieces);
  return {
    carrier,
    trackings: trackingsOf(
      carrier,
      raw.trackingNumber,
      shipperAccount,
      raw.service,
    ),
    ...(recipient === undefined ? {} : { recipient }),
    ...(parsedPieces === undefined ? {} : { pieces: parsedPieces }),
    ...(weight === undefined ? {} : { weightKg: weight }),
    ...(raw.service === undefined ? {} : { service: raw.service }),
    ...(shipperAccount === undefined ? {} : { shipperAccount }),
    ...(raw.shipmentId === undefined ? {} : { reference: raw.shipmentId }),
    fields: raw,
  };
};

const dataIdentifiers = (fields: string[]): Record<string, string> => {
  const found: Record<string, string> = {};
  for (const field of fields) {
    const match = /^(\d{1,2}[A-Z])(.*)$/.exec(field);
    if (match && match[2] !== '') found[match[1]!] = match[2]!;
  }
  return found;
};

const geopostPhone = (fields: string[]): string | undefined => {
  for (const field of fields) {
    for (const part of field.split(US)) {
      const found = phone(part);
      if (found !== undefined) return found;
    }
  }
  return undefined;
};

export const parseIso15434 = (code: string): ParsedCode | null => {
  const envelopes = envelopesOf(code);
  if (envelopes === null) return null;
  const main = envelopes.find((e) => e.format === '01');
  const base = main === undefined ? null : transport(main.fields);
  if (base === null) return null;

  const result: ParsedCode = { scheme: 'iso15434', ...base };
  for (const envelope of envelopes) {
    if (envelope.format === '06') {
      const dis = dataIdentifiers(envelope.fields);
      Object.assign(result.fields, dis);
      const sender: Party | undefined = party({
        name: text(dis['11Z']),
        phone: phone(dis['12Z']),
      });
      if (sender !== undefined) result.sender = sender;
    }
    if (envelope.format === '07') {
      const found = geopostPhone(envelope.fields);
      if (found !== undefined) {
        result.recipient = { ...result.recipient, phone: found };
      }
    }
  }
  return result;
};
