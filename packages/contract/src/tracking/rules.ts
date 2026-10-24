import {
  dhlCheck,
  dpdCheck,
  fedexCheck,
  gs1Check,
  s10Check,
  upsCheck,
} from './check-digits';

export const trackingContexts = [
  'colissimo',
  'chronopost',
  'la-poste',
  'dhl-express',
  'dhl-paket',
  'deutsche-post',
  'ups',
  'fedex',
  'dpd',
  'gls',
  'tnt',
  'hermes',
  'usps',
  'royal-mail',
  'amazon',
  'mondial-relay',
  'colis-prive',
  'other',
] as const;

export type TrackingContext = (typeof trackingContexts)[number];

export type TrackingPolicy =
  'key' | 'key-and-context' | 'key-bonus' | 'format-and-context';

export type TrackingRule = {
  id: string;
  carrier: TrackingContext | null;
  pattern: RegExp;
  policy: TrackingPolicy;
  contexts: readonly TrackingContext[] | 'any';
  check?: (value: string) => boolean;
  shipperAccount?: (value: string) => string;
};

const lastIs = (check: (body: string) => string, from: number) => {
  return (value: string) => check(value.slice(from, -1)) === value.at(-1);
};

const s10Valid = (value: string, from: number) =>
  s10Check(value.slice(from, from + 8)) === value[from + 8];

const POSTAL_CONTEXTS: readonly TrackingContext[] = [
  'la-poste',
  'colissimo',
  'deutsche-post',
  'royal-mail',
  'usps',
  'other',
];

export const trackingRules: readonly TrackingRule[] = [
  {
    id: 'ups-1z',
    carrier: 'ups',
    pattern: /^1Z[A-Z0-9]{15}\d$/,
    policy: 'key',
    contexts: ['ups'],
    check: lastIs(upsCheck, 2),
    shipperAccount: (value) => value.slice(2, 8),
  },
  {
    id: 'fedex-express-12',
    carrier: 'fedex',
    pattern: /^\d{12}$/,
    policy: 'key',
    contexts: ['fedex'],
    check: lastIs(fedexCheck, 0),
  },
  {
    id: 'fedex-ground-96',
    carrier: 'fedex',
    pattern: /^96\d{20}$/,
    policy: 'key',
    contexts: ['fedex'],
    check: lastIs(gs1Check, 7),
    shipperAccount: (value) => value.slice(7, 14),
  },
  {
    id: 'fedex-ground-15',
    carrier: 'fedex',
    pattern: /^\d{15}$/,
    policy: 'key',
    contexts: ['fedex'],
    check: lastIs(gs1Check, 0),
    shipperAccount: (value) => value.slice(0, 7),
  },
  {
    id: 'dhl-express-waybill',
    carrier: 'dhl-express',
    pattern: /^\d{10}$/,
    policy: 'key-and-context',
    contexts: ['dhl-express'],
    check: lastIs(dhlCheck, 0),
  },
  {
    id: 'colissimo-id13',
    carrier: 'colissimo',
    pattern: /^\d[A-Z]\d{11}$/,
    policy: 'key',
    contexts: ['colissimo'],
    check: lastIs(gs1Check, 2),
  },
  {
    id: 'la-poste-13',
    carrier: 'la-poste',
    pattern: /^\d[A-Z]\d{11}$/,
    policy: 'format-and-context',
    contexts: ['la-poste'],
  },
  {
    id: 'la-poste-14',
    carrier: 'la-poste',
    pattern: /^\d{14}$/,
    policy: 'format-and-context',
    contexts: ['la-poste'],
  },
  {
    id: 'upu-s10',
    carrier: null,
    pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$/,
    policy: 'key',
    contexts: POSTAL_CONTEXTS,
    check: (value) => s10Valid(value, 2),
  },
  {
    id: 'chronopost-13',
    carrier: 'chronopost',
    pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$/,
    policy: 'format-and-context',
    contexts: ['chronopost'],
  },
  {
    id: 'dpd-15',
    carrier: 'dpd',
    pattern: /^\d{14}[A-Z0-9]$/,
    policy: 'key',
    contexts: ['dpd'],
    check: lastIs(dpdCheck, 0),
  },
  {
    id: 'dpd-14',
    carrier: 'dpd',
    pattern: /^\d{14}$/,
    policy: 'format-and-context',
    contexts: ['dpd'],
  },
  {
    id: 'tnt-9',
    carrier: 'tnt',
    pattern: /^\d{9}$/,
    policy: 'key-bonus',
    contexts: ['tnt'],
    check: (value) => s10Valid(value, 0),
  },
  {
    id: 'tnt-ge',
    carrier: 'tnt',
    pattern: /^GE\d{9}WW$/,
    policy: 'format-and-context',
    contexts: ['tnt'],
  },
  {
    id: 'gls-12',
    carrier: 'gls',
    pattern: /^\d{12}$/,
    policy: 'format-and-context',
    contexts: ['gls'],
  },
  {
    id: 'gs1-sscc',
    carrier: null,
    pattern: /^00\d{18}$/,
    policy: 'key',
    contexts: 'any',
    check: lastIs(gs1Check, 2),
  },
];
