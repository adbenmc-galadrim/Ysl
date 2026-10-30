import type { ReadableFormat } from '@repo/barcode';
import type { TrackingContext } from '@repo/contract/tracking';

/**
 * The symbols a carrier prints beside its 1D tracking code (S2). Once the
 * first pass names the carrier, the reader goes back for the ones it missed.
 */
export const CARRIER_FORMATS: Partial<
  Record<TrackingContext, readonly ReadableFormat[]>
> = {
  ups: ['Code128', 'MaxiCode'],
  fedex: ['Code128', 'PDF417'],
  colissimo: ['Code128', 'Aztec'],
  chronopost: ['Code128', 'Aztec'],
  dpd: ['Code128', 'Aztec'],
  'dhl-express': ['Code39', 'Code128', 'DataMatrix'],
  'dhl-paket': ['Code128', 'DataMatrix'],
  'deutsche-post': ['Code128', 'DataMatrix'],
  'la-poste': ['DataMatrix'],
};

/** The carrier's formats not among the symbols read; empty when all are. */
export function missingFormats(
  carrier: TrackingContext | null,
  symbols: readonly { format: string }[],
): ReadableFormat[] {
  const expected = carrier ? CARRIER_FORMATS[carrier] : undefined;
  if (!expected) return [];
  const read = new Set(symbols.map((symbol) => symbol.format));
  return expected.filter((format) => !read.has(format));
}
