import { parseCode, type ParsedCode } from '@repo/contract/codes';
import {
  type BarcodeTracking,
  type TrackingContext,
  type TrackingVerdict,
  trackingsInBarcode,
  validateTracking,
} from '@repo/contract/tracking';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { carrierName } from '#/features/scan/carriers';

export type ExtractedTracking = {
  context: TrackingContext | null;
  carrier: string | null;
  tracking: string;
  trackingNorm: string;
};

/** The tracking kept for a label, with the structured code it came from. */
export type SelectedTracking = {
  verdict: TrackingVerdict;
  parsed: ParsedCode | null;
};

type CodeSymbol = { format: string; text: string };

const t = createTranslator(DEFAULT_LOCALE);

const RANK: Record<TrackingVerdict['status'], number> = {
  sure: 0,
  'to-verify': 2,
  rejected: 4,
};

/** A sure number that names its carrier beats a bare SSCC (§4.3). */
const rank = (verdict: TrackingVerdict) =>
  RANK[verdict.status] + (verdict.carrier === null ? 1 : 0);

/** A structured 2D code first (§4.3), else the 1D envelopes. */
const candidatesOf = (
  symbol: CodeSymbol,
): { parsed: ParsedCode | null; trackings: BarcodeTracking[] } => {
  const parsed = parseCode(symbol.text, symbol.format);
  if (parsed !== null && parsed.trackings.length > 0) {
    return { parsed, trackings: parsed.trackings };
  }
  return { parsed: null, trackings: trackingsInBarcode(symbol.text) };
};

/**
 * The tracking number among the symbols read: every candidate of every
 * symbol is validated, the surest wins, a rejected one is no number at all.
 */
export function selectTracking(
  symbols: readonly CodeSymbol[],
): SelectedTracking | null {
  let best: SelectedTracking | undefined;
  for (const symbol of symbols) {
    const { parsed, trackings } = candidatesOf(symbol);
    for (const found of trackings) {
      const verdict = validateTracking(found.value, { context: found.context });
      if (verdict.status === 'rejected') continue;
      if (!best || rank(verdict) < rank(best.verdict))
        best = { verdict, parsed };
      if (rank(best.verdict) === 0) return best;
    }
  }
  return best ?? null;
}

const toExtracted = ({ verdict }: SelectedTracking): ExtractedTracking => ({
  context: verdict.carrier,
  carrier: verdict.carrier ? carrierName(verdict.carrier, t) : null,
  tracking: verdict.value,
  trackingNorm: verdict.value,
});

export function extractTracking(
  symbols: readonly CodeSymbol[],
): ExtractedTracking | null {
  const selected = selectTracking(symbols);
  return selected ? toExtracted(selected) : null;
}
