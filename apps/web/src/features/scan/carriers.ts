import type { TrackingContext } from '@repo/contract/tracking';
import type { TranslateFn, TranslationKey } from '@repo/shared/i18n';

type CarrierKey = Extract<TranslationKey, `carrier.${string}`>;

const CARRIER_KEYS: Record<TrackingContext, CarrierKey> = {
  colissimo: 'carrier.colissimo',
  chronopost: 'carrier.chronopost',
  'la-poste': 'carrier.la-poste',
  'dhl-express': 'carrier.dhl-express',
  'dhl-paket': 'carrier.dhl-paket',
  'deutsche-post': 'carrier.deutsche-post',
  ups: 'carrier.ups',
  fedex: 'carrier.fedex',
  dpd: 'carrier.dpd',
  gls: 'carrier.gls',
  tnt: 'carrier.tnt',
  hermes: 'carrier.hermes',
  usps: 'carrier.usps',
  'royal-mail': 'carrier.royal-mail',
  amazon: 'carrier.amazon',
  'mondial-relay': 'carrier.mondial-relay',
  'colis-prive': 'carrier.colis-prive',
  other: 'carrier.other',
};

/** How the carrier reads on screen; the context key stays internal. */
export const carrierName = (context: TrackingContext, t: TranslateFn) =>
  t(CARRIER_KEYS[context]);
