import {
  type TrackingContext,
  type TrackingVerdict,
  trackingsInBarcode,
  validateTracking,
} from '@repo/contract/tracking';

export type ExtractedTracking = {
  context: TrackingContext | null;
  carrier: string | null;
  tracking: string;
  trackingNorm: string;
};

/** How the carrier reads on a list row; the context key stays internal. */
export const CARRIER_LABELS: Record<TrackingContext, string> = {
  colissimo: 'Colissimo',
  chronopost: 'Chronopost',
  'la-poste': 'La Poste',
  'dhl-express': 'DHL Express',
  'dhl-paket': 'DHL Paket',
  'deutsche-post': 'Deutsche Post',
  ups: 'UPS',
  fedex: 'FedEx',
  dpd: 'DPD',
  gls: 'GLS',
  tnt: 'TNT',
  hermes: 'Hermes',
  usps: 'USPS',
  'royal-mail': 'Royal Mail',
  amazon: 'Amazon',
  'mondial-relay': 'Mondial Relay',
  'colis-prive': 'Colis Privé',
  other: 'Autre',
};

const RANK: Record<TrackingVerdict['status'], number> = {
  sure: 0,
  'to-verify': 1,
  rejected: 2,
};

const toExtracted = (verdict: TrackingVerdict): ExtractedTracking => ({
  context: verdict.carrier,
  carrier: verdict.carrier ? CARRIER_LABELS[verdict.carrier] : null,
  tracking: verdict.value,
  trackingNorm: verdict.value,
});

/**
 * The tracking number among the symbols read: every candidate of every
 * symbol is validated, the surest wins, a rejected one is no number at all.
 */
export function extractTracking(
  symbols: readonly { format: string; text: string }[],
): ExtractedTracking | null {
  let best: TrackingVerdict | undefined;
  for (const symbol of symbols) {
    for (const found of trackingsInBarcode(symbol.text)) {
      const verdict = validateTracking(found.value, { context: found.context });
      if (verdict.status === 'rejected') continue;
      if (!best || RANK[verdict.status] < RANK[best.status]) best = verdict;
      if (best.status === 'sure') return toExtracted(best);
    }
  }
  return best ? toExtracted(best) : null;
}
