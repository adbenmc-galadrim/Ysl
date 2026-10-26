import { describe, expect, it } from 'vitest';
import { BOM, csvCell, textCell, toCsv } from '#features/exports/csv';
import { parseCsv } from './helpers/csv';

describe('csvCell', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+33 6 12 34 56 78', "'+33 6 12 34 56 78"],
    ['-2', "'-2"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\t=1', "'\t=1"],
    ['\r=1', `"'\r=1"`],
  ])('turns %j into text Excel will not run', (value, cell) => {
    expect(csvCell(value)).toBe(cell);
  });

  it('quotes a formula that also holds a separator', () => {
    expect(csvCell('=HYPERLINK("x";"y")')).toBe(`"'=HYPERLINK(""x"";""y"")"`);
  });

  it('quotes and doubles the quotes of a cell with a quote', () => {
    expect(csvCell('Colis "fragile"')).toBe('"Colis ""fragile"""');
  });

  it.each([
    ['Bât. A; 2e étage', '"Bât. A; 2e étage"'],
    ['ligne 1\nligne 2', '"ligne 1\nligne 2"'],
    ['ligne 1\r\nligne 2', '"ligne 1\r\nligne 2"'],
  ])('quotes %j, which would split the line', (value, cell) => {
    expect(csvCell(value)).toBe(cell);
  });

  it('leaves accents and a plain value as they are', () => {
    expect(csvCell('Hélène Éloïse Çà')).toBe('Hélène Éloïse Çà');
    expect(csvCell('1Z999AA10123456784')).toBe('1Z999AA10123456784');
  });

  it('writes an empty cell for a missing value', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('')).toBe('');
  });
});

describe('textCell', () => {
  it('keeps a code of digits as text, leading zeros and all', () => {
    expect(csvCell(textCell('008123456789012345'))).toBe(
      '"=""008123456789012345"""',
    );
  });

  it('leaves any other code to the plain rules, formulas still neutralised', () => {
    expect(csvCell(textCell('1Z999AA10123456784'))).toBe('1Z999AA10123456784');
    expect(csvCell(textCell('=1+1'))).toBe("'=1+1");
    expect(csvCell(textCell(null))).toBe('');
  });

  it('never wraps something that is not only digits', () => {
    expect(csvCell({ text: '1")+cmd("' })).toBe('"1"")+cmd("""');
  });
});

describe('toCsv', () => {
  const csv = toCsv(
    ['id', 'notes'],
    [
      ['1', 'Laissé à l’accueil\npar le livreur'],
      ['2', '=cmd|" /C calc"!A0'],
    ],
  );

  it('starts with a BOM and ends every line with \\r\\n', () => {
    expect(BOM).toBe('\uFEFF');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')[0]).toBe('id;notes');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('reads back to the same cells, the formula kept as text', () => {
    expect(parseCsv(csv)).toEqual([
      ['id', 'notes'],
      ['1', 'Laissé à l’accueil\npar le livreur'],
      ['2', `'=cmd|" /C calc"!A0`],
    ]);
  });

  it('keeps the accents through UTF-8 bytes', () => {
    const bytes = new TextEncoder().encode(csv);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toContain('Laissé à l’accueil');
  });
});
