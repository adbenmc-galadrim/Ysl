import { describe, expect, it } from 'vitest';
import {
  parseCode,
  parseLaPosteDataMatrix,
  parseSymbols,
} from '@repo/contract/codes';
import { validateTracking } from '@repo/contract/tracking';

const GS = '\u001d';
const RS = '\u001e';

describe('La Poste Data Matrix', () => {
  it('reads the tracking after the 8-character prefix', () => {
    const code = parseLaPosteDataMatrix('FR00A0013Y004321547890001');
    expect(code).toEqual({
      scheme: 'la-poste',
      carrier: 'la-poste',
      trackings: [{ value: '3Y00432154789', context: 'la-poste' }],
      fields: {
        prefix: 'FR00A001',
        trackingNumber: '3Y00432154789',
        suffix: '0001',
      },
    });
    const [tracking] = code!.trackings;
    expect(validateTracking(tracking!.value, tracking).status).toBe('sure');
  });

  it('reads a 14-digit tracking', () => {
    expect(parseLaPosteDataMatrix('FR01B00212345678901234')?.trackings).toEqual(
      [{ value: '12345678901234', context: 'la-poste' }],
    );
  });

  it('ignores the other Data Matrix met on labels', () => {
    expect(parseLaPosteDataMatrix('DEA123456789ABCDEF')).toBeNull();
    expect(parseLaPosteDataMatrix('AL1234567890')).toBeNull();
    expect(parseLaPosteDataMatrix('A27610115123456789012')).toBeNull();
    expect(parseLaPosteDataMatrix('')).toBeNull();
  });
});

describe('parseCode routes a symbol to its parser', () => {
  const aztec = `[)>${RS}01${GS}02${GS}75007${GS}250${GS}925${GS}HA915306631JB${GS}CHRO`;

  it('tries ISO 15434, GS1 then La Poste', () => {
    expect(parseCode(aztec, 'Aztec')?.scheme).toBe('iso15434');
    expect(parseCode('(00)340434122150000874', 'Code128')?.scheme).toBe('gs1');
    expect(parseCode('FR00A0013Y004321547890001', 'DataMatrix')?.scheme).toBe(
      'la-poste',
    );
    expect(parseCode('FR00A0013Y004321547890001')?.scheme).toBe('la-poste');
  });

  it('falls back to La Poste when a GS1-looking text has no element', () => {
    expect(
      parseCode(`FR00A0013Y004321547890001${GS}`, 'DataMatrix')?.scheme,
    ).toBe('la-poste');
  });

  it('does not read a La Poste structure out of a 1D code', () => {
    expect(parseCode('FR00A0013Y004321547890001', 'Code128')).toBeNull();
  });

  it('returns null on plain text', () => {
    expect(parseCode('1ZE6344W0499230622', 'Code128')).toBeNull();
    expect(parseCode('877974873338')).toBeNull();
  });

  it('keeps the order of the symbols and skips the unstructured ones', () => {
    const parsed = parseSymbols([
      { format: 'Code128', text: 'HA915306631JB' },
      { format: 'Aztec', text: aztec },
      { format: 'DataMatrix', text: 'FR00A0013Y004321547890001' },
    ]);
    expect(parsed.map((p) => p.scheme)).toEqual(['iso15434', 'la-poste']);
  });
});
