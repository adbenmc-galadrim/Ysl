import type { CarrierService, Pieces } from '../codes';
import { weightKg } from '../codes/fields';
import { REGISTERED } from '../codes/services';
import type { TrackingContext } from '../tracking/rules';
import { CONFIDENCE } from './confidence';
import type { Observation } from './fields';
import type { FieldSource } from './types';

export type OcrObservations = {
  pieces: Observation<Pieces>[];
  weights: Observation<number>[];
  services: Observation<CarrierService>[];
  references: Observation<string>[];
};

export const OCR_FORMAT = 'text';

/** The plausible weight of a parcel (§4.3, « cohérence métier »). */
export const MIN_WEIGHT_KG = 0.01;
export const MAX_WEIGHT_KG = 70;

export const plausibleWeight = (kg: number) =>
  kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG;

/** Rounded to the hectogram: « 2.6 LBS » and « 1.2 KG » on one label agree. */
export const weightKey = (kg: number) => kg.toFixed(1);

const ocrSource = (confidence: number, value: string): FieldSource => ({
  kind: 'ocr',
  format: OCR_FORMAT,
  confidence,
  value,
});

const plain = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

/** « PKG 1 OF 3 », « COLIS 1 SUR 3 », « PIECE 1/3 » : a form the label states. */
const WORDED_PIECES =
  /\b(?:PKGS?|PCS?|PIECES?|COLIS|PARCELS?|CARTONS?|BOX(?:ES)?)\s*#?\s*(\d{1,3})\s*(?:OF|SUR|DE|\/)\s*(\d{1,3})\b|(?<!PAGE\s)(?<!SHEET\s)\b(\d{1,3})\s+(?:OF|SUR)\s+(\d{1,3})\b/g;

/** « 1/3 » on its own, as long as nothing makes it a date or a fraction of more. */
const BARE_PIECES = /(?<![\d/.,:-])(\d{1,2})\/(\d{1,2})(?![\d/.,:-])/g;

const WEIGHT = /(?<![\d.,])(\d{1,3}(?:[.,]\d{1,3})?\s*(?:KGS?|LBS?))\b/g;

const REFERENCE =
  /\bREF(?:ERENCE)?(?![A-Z])\.?\s*(?:N[O°]\.?\s*|#\s*|:\s*)?[:#]?\s*([A-Z0-9][A-Z0-9/-]{2,})\b/g;

type ServiceName = {
  pattern: RegExp;
  label: string;
  /** The carriers that print this name; any when absent. */
  carriers?: readonly TrackingContext[];
  /** A name that means this only once the carrier is known. */
  strict?: true;
};

/** Service names as printed, longest first; the first one found names the service. */
const SERVICES: readonly ServiceName[] = [
  {
    pattern: /NEXT DAY AIR SAVER/,
    label: 'Next Day Air Saver',
    carriers: ['ups'],
  },
  {
    pattern: /NEXT DAY AIR EARLY/,
    label: 'Next Day Air Early',
    carriers: ['ups'],
  },
  { pattern: /NEXT DAY AIR/, label: 'Next Day Air', carriers: ['ups'] },
  {
    pattern: /2ND DAY AIR A\.?M\.?/,
    label: '2nd Day Air A.M.',
    carriers: ['ups'],
  },
  { pattern: /2ND DAY AIR/, label: '2nd Day Air', carriers: ['ups'] },
  { pattern: /3 DAY SELECT/, label: '3 Day Select', carriers: ['ups'] },
  {
    pattern: /WORLDWIDE EXPRESS PLUS/,
    label: 'Worldwide Express Plus',
    carriers: ['ups'],
  },
  {
    pattern: /WORLDWIDE EXPRESS SAVER|WORLDWIDE SAVER|UPS EXPRESS SAVER/,
    label: 'Worldwide Saver',
    carriers: ['ups'],
  },
  {
    pattern: /WORLDWIDE EXPRESS/,
    label: 'Worldwide Express',
    carriers: ['ups'],
  },
  {
    pattern: /WORLDWIDE EXPEDITED/,
    label: 'Worldwide Expedited',
    carriers: ['ups'],
  },
  { pattern: /UPS STANDARD/, label: 'Standard', carriers: ['ups'] },
  {
    pattern: /PRIORITY OVERNIGHT/,
    label: 'Priority Overnight',
    carriers: ['fedex'],
  },
  {
    pattern: /STANDARD OVERNIGHT/,
    label: 'Standard Overnight',
    carriers: ['fedex'],
  },
  { pattern: /FIRST OVERNIGHT/, label: 'First Overnight', carriers: ['fedex'] },
  { pattern: /EXPRESS SAVER/, label: 'Express Saver', carriers: ['fedex'] },
  {
    pattern: /EXPRESS SAVER/,
    label: 'Worldwide Saver',
    carriers: ['ups'],
    strict: true,
  },
  { pattern: /\b2 ?DAY\b/, label: '2Day', carriers: ['fedex'] },
  { pattern: /HOME DELIVERY/, label: 'Home Delivery', carriers: ['fedex'] },
  {
    pattern: /\bGROUND\b(?!\s*FLOOR)/,
    label: 'Ground',
    carriers: ['ups', 'fedex'],
  },
  {
    pattern: /EXPRESS WORLDWIDE/,
    label: 'Express Worldwide',
    carriers: ['dhl-express'],
  },
  {
    pattern: /EXPRESS (9:00|10:30|12:00|12)\b/,
    label: 'Express $1',
    carriers: ['dhl-express'],
  },
  {
    pattern: /CHRONO ?(10|13|18)\b/,
    label: 'Chrono $1',
    carriers: ['chronopost'],
  },
  {
    pattern: /CHRONO ?EXPRESS/,
    label: 'Chrono Express',
    carriers: ['chronopost'],
  },
  { pattern: /\bPREDICT\b/, label: 'Predict', carriers: ['dpd'] },
  { pattern: /DPD CLASSIC/, label: 'Classic', carriers: ['dpd'] },
  { pattern: /LETTRE SUIVIE/, label: 'Lettre suivie', carriers: ['la-poste'] },
  { pattern: /RECOMMANDE|REGISTERED|EINSCHREIBEN/, label: REGISTERED },
];

const piecesOf = (index: number, total: number): Pieces | null =>
  index >= 1 && total >= 1 && index <= total ? { index, total } : null;

/** §4.5 « Colis n/N » : the worded forms at rank 6, a bare « n/N » at rank 7. */
export const ocrPieces = (text: string): Observation<Pieces>[] => {
  const found: Observation<Pieces>[] = [];
  const seen = new Set<string>();
  const add = (index: number, total: number, confidence: number) => {
    const pieces = piecesOf(index, total);
    if (pieces === null) return;
    const key = `${index}/${total}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ key, value: pieces, source: ocrSource(confidence, key) });
  };
  for (const m of text.matchAll(WORDED_PIECES)) {
    add(Number(m[1] ?? m[3]), Number(m[2] ?? m[4]), CONFIDENCE.ocrFormat);
  }
  for (const m of text.matchAll(BARE_PIECES)) {
    add(Number(m[1]), Number(m[2]), CONFIDENCE.unvalidated);
  }
  return found;
};

/** §4.5 « Poids » : « KG » or « LBS » printed next to the number, kept if plausible. */
export const ocrWeights = (text: string): Observation<number>[] => {
  const found = new Map<string, Observation<number>>();
  for (const m of text.matchAll(WEIGHT)) {
    const kg = weightKg(m[1]);
    if (kg === undefined || !plausibleWeight(kg)) continue;
    const key = weightKey(kg);
    if (!found.has(key)) {
      found.set(key, {
        key,
        value: kg,
        source: ocrSource(CONFIDENCE.ocrFormat, m[0].trim()),
      });
    }
  }
  return [...found.values()];
};

/**
 * §4.5 « Service transporteur » : the first service name printed on the
 * label. The carrier the codes voted for rules out the names of the others:
 * « EXPRESS SAVER » is one service at UPS, another at FedEx.
 */
export const ocrServices = (
  text: string,
  carrier: TrackingContext | null = null,
): Observation<CarrierService>[] => {
  for (const { pattern, label, carriers, strict } of SERVICES) {
    if (carriers && (carrier === null ? strict : !carriers.includes(carrier)))
      continue;
    const m = pattern.exec(text);
    if (m === null) continue;
    const name = label.replace('$1', m[1] ?? '');
    return [
      {
        key: name,
        value: { code: null, label: name },
        source: ocrSource(CONFIDENCE.ocrFormat, m[0]),
      },
    ];
  }
  return [];
};

/** §4.5 « Référence » : what follows « REF », without a shape to check (rank 7). */
export const ocrReferences = (text: string): Observation<string>[] => {
  const found = new Map<string, Observation<string>>();
  for (const m of text.matchAll(REFERENCE)) {
    const value = m[1]!;
    if (!found.has(value)) {
      found.set(value, {
        key: value,
        value,
        source: ocrSource(CONFIDENCE.unvalidated, value),
      });
    }
  }
  return [...found.values()];
};

export const observeOcr = (
  raw: string,
  carrier: TrackingContext | null = null,
): OcrObservations => {
  const text = plain(raw);
  return {
    pieces: ocrPieces(text),
    weights: ocrWeights(text),
    services: ocrServices(text, carrier),
    references: ocrReferences(text),
  };
};
