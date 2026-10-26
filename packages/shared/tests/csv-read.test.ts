import { describe, expect, it } from 'vitest';
import { guessSeparator, readCsv, readCsvRecords } from '../src/csv-read';

describe('guessSeparator', () => {
  it('keeps the semicolon unless commas outnumber it, as the v1 did', () => {
    expect(guessSeparator('id;tracking;notes\n1;2;3')).toBe(';');
    expect(guessSeparator('id,tracking,notes\n1;2;3')).toBe(',');
    expect(guessSeparator('a,b;c,d;e\n')).toBe(';');
  });
});

describe('readCsv', () => {
  it('drops the byte order mark and splits on the separator', () => {
    expect(readCsv('\uFEFFid;tracking\r\n1;1Z9\r\n')).toEqual([
      ['id', 'tracking'],
      ['1', '1Z9'],
    ]);
  });

  it('reads a comma file', () => {
    expect(readCsv('id,nom\n1,Zoé')).toEqual([
      ['id', 'nom'],
      ['1', 'Zoé'],
    ]);
  });

  it('keeps separators, line breaks and doubled quotes inside quotes', () => {
    const text = 'a;b;c\n"x;y";"ligne 1\r\nligne 2";"dit ""oui"""\n';
    expect(readCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['x;y', 'ligne 1\r\nligne 2', 'dit "oui"'],
    ]);
  });

  it('skips blank rows and rows of separators, keeps empty cells', () => {
    expect(readCsv('a;b\n\n;\r\n\r\n1;\n;;\n')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ]);
  });

  it('tells the line of the file each row starts on', () => {
    const text = 'a;b\r\n1;"x\r\ny"\r\n\r\n2;z\n3;"\n\n"\r4;w';
    expect(readCsvRecords(text).map((record) => record.line)).toEqual([
      1, 2, 5, 6, 9,
    ]);
  });

  it('reads the last row without a final line break', () => {
    expect(readCsv('a;b\n"Éloïse";Hélène')).toEqual([
      ['a', 'b'],
      ['Éloïse', 'Hélène'],
    ]);
  });

  it('takes a quote in the middle of a cell as text', () => {
    expect(readCsv('a\n12" écran')).toEqual([['a'], ['12" écran']]);
  });
});
