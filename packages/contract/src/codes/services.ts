import type { TrackingContext } from '../tracking/rules';

/** A carrier's level of service: the code the label carries, the name it means. */
export type CarrierService = { code: string | null; label: string | null };

/**
 * UPS service codes, the two characters after the shipper account of a 1Z;
 * the MaxiCode service class ends with the same two digits (rapport 03).
 */
const UPS_SERVICES: Record<string, string> = {
  '01': 'Next Day Air',
  '02': '2nd Day Air',
  '03': 'Ground',
  '07': 'Worldwide Express',
  '08': 'Worldwide Expedited',
  '11': 'Standard',
  '12': '3 Day Select',
  '13': 'Next Day Air Saver',
  '14': 'Next Day Air Early',
  '54': 'Worldwide Express Plus',
  '59': '2nd Day Air A.M.',
  '65': 'Worldwide Saver',
};

/** FedEx service classes as printed in the PDF417 and the « 96 » barcode. */
const FEDEX_SERVICES: Record<string, string> = {
  '001': 'Priority Overnight',
  '003': '2Day',
  '005': 'Standard Overnight',
  '006': 'First Overnight',
  '020': 'Express Saver',
  '090': 'Home Delivery',
  '092': 'Ground',
};

export const REGISTERED = 'Recommandé';

/**
 * The name of a service code, when the carrier publishes its codes. The
 * Geopost codes (Colissimo, DPD, Chronopost) are kept as codes only.
 */
export const serviceLabel = (
  carrier: TrackingContext | null,
  code: string,
): string | null => {
  switch (carrier) {
    case 'ups':
      return UPS_SERVICES[code.slice(-2)] ?? null;
    case 'fedex':
      return FEDEX_SERVICES[code.padStart(3, '0')] ?? null;
    default:
      return null;
  }
};

/** A UPS class read in a MaxiCode (`004`) and in a 1Z (`04`) is one code. */
const canonicalCode = (carrier: TrackingContext | null, code: string) =>
  carrier === 'ups' ? code.slice(-2) : code;

export const carrierService = (
  carrier: TrackingContext | null,
  code: string,
): CarrierService => ({
  code: canonicalCode(carrier, code),
  label: serviceLabel(carrier, code),
});

const S10 = /^([A-Z])[A-Z]\d{9}[A-Z]{2}$/;

/**
 * What a tracking number alone says of the service (§4.3 rank 3): the UPS
 * code inside the 1Z, and the UPU S10 service indicator, whose `R` marks a
 * registered item (rapport 03, §UPU).
 */
export const serviceOfTracking = (
  value: string,
  carrier: TrackingContext | null,
): CarrierService | null => {
  if (carrier === 'ups' && /^1Z[A-Z0-9]{16}$/.test(value)) {
    return carrierService('ups', value.slice(8, 10));
  }
  const s10 = S10.exec(value);
  if (s10 !== null && carrier !== 'chronopost' && s10[1] === 'R') {
    return { code: null, label: REGISTERED };
  }
  return null;
};
