import { looksLikeGs1, parseGs1 } from './gs1';
import { parseIso15434 } from './iso15434';
import { parseLaPosteDataMatrix } from './la-poste';
import type { ParsedCode } from './types';

export { EOT, GS, RS, US } from './fields';
export { type Gs1Elements, looksLikeGs1, parseGs1, splitGs1 } from './gs1';
export { parseIso15434 } from './iso15434';
export { parseLaPosteDataMatrix } from './la-poste';
export {
  type CarrierService,
  carrierService,
  REGISTERED,
  serviceLabel,
  serviceOfTracking,
} from './services';
export type { CodeScheme, ParsedCode, Party, Pieces } from './types';

export type CodeSymbol = { format: string; text: string };

/** The JD plate and the 2L routing code name DHL Express; its tracking stays the WAYBILL. */
const DHL_ROUTING = /^(?:J?JD\d{18}|2L[A-Z]{2}\d+\+\d+)$/;

export const parseCode = (text: string, format?: string): ParsedCode | null => {
  if (text.startsWith('[)>')) return parseIso15434(text);
  if (DHL_ROUTING.test(text)) {
    return {
      scheme: 'dhl-routing',
      carrier: 'dhl-express',
      trackings: [],
      fields: {},
    };
  }
  const gs1 = looksLikeGs1(text) ? parseGs1(text) : null;
  if (gs1 !== null) return gs1;
  if (format === undefined || format === 'DataMatrix') {
    return parseLaPosteDataMatrix(text);
  }
  return null;
};

export const parseSymbols = (symbols: readonly CodeSymbol[]): ParsedCode[] =>
  symbols.flatMap((symbol) => {
    const parsed = parseCode(symbol.text, symbol.format);
    return parsed === null ? [] : [parsed];
  });
