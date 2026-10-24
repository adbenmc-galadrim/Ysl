import { gs1Check } from './check-digits';
import { normalizeTracking } from './normalize';
import type { TrackingContext } from './rules';

export type BarcodeTracking = { value: string; context?: TrackingContext };

const FEDEX_34 = /^\d{34}$/;
const FEDEX_96 = /^96\d{20}$/;
const GEOPOST_COLISSIMO = /^%\d{7}11(\d[A-Z]\d{10})\d{6}$/;
const GEOPOST_DPD = /^%\d{7}(\d{14})\d{6}$/;
const GS1_SSCC = /\(00\)(\d{18})/;

const extract = (text: string): BarcodeTracking[] => {
  if (FEDEX_34.test(text)) {
    return [{ value: text.slice(-12), context: 'fedex' }];
  }
  if (FEDEX_96.test(text)) {
    return [
      { value: text, context: 'fedex' },
      { value: text.slice(7), context: 'fedex' },
    ];
  }
  const colissimo = GEOPOST_COLISSIMO.exec(text)?.[1];
  if (colissimo !== undefined) {
    const value = `${colissimo}${gs1Check(colissimo.slice(2))}`;
    return [{ value, context: 'colissimo' }];
  }
  const dpd = GEOPOST_DPD.exec(text)?.[1];
  if (dpd !== undefined) return [{ value: dpd, context: 'dpd' }];
  const sscc = GS1_SSCC.exec(text)?.[1];
  if (sscc !== undefined) return [{ value: `00${sscc}` }];
  return [];
};

export const trackingsInBarcode = (text: string): BarcodeTracking[] => {
  const value = normalizeTracking(text);
  if (value === '') return [];
  const found = extract(value);
  return found.some((f) => f.value === value) ? found : [...found, { value }];
};
