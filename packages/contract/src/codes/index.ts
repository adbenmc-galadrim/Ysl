import { looksLikeGs1, parseGs1 } from './gs1';
import { parseIso15434 } from './iso15434';
import { parseLaPosteDataMatrix } from './la-poste';
import type { ParsedCode } from './types';

export { EOT, GS, RS, US } from './fields';
export { type Gs1Elements, looksLikeGs1, parseGs1, splitGs1 } from './gs1';
export { parseIso15434 } from './iso15434';
export { parseLaPosteDataMatrix } from './la-poste';
export type { CodeScheme, ParsedCode, Party, Pieces } from './types';

export type CodeSymbol = { format: string; text: string };

export const parseCode = (text: string, format?: string): ParsedCode | null => {
  if (text.startsWith('[)>')) return parseIso15434(text);
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
