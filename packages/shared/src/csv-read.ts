/**
 * The separator of a CSV file, guessed from its first line the way the v1
 * did: `;` unless the line holds more commas than semicolons.
 */
export function guessSeparator(text: string): ';' | ',' {
  const end = text.search(/\r|\n/);
  const first = end < 0 ? text : text.slice(0, end);
  const count = (char: string) => first.split(char).length - 1;
  return count(';') >= count(',') ? ';' : ',';
}

/**
 * The rows of a CSV file as written by Excel or the v1: byte order mark
 * dropped, cells in double quotes may hold the separator, a line break or
 * a doubled quote, `\r\n` and `\n` both end a row, blank rows are skipped.
 */
export function readCsv(input: string, separator = guessSeparator(input)) {
  const text = input.startsWith('﻿') ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        cell += char;
      }
      i += 1;
      continue;
    }
    if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === separator) {
      endCell();
    } else if (char === '\r' || char === '\n') {
      endRow();
      if (char === '\r' && text[i + 1] === '\n') i += 1;
    } else {
      cell += char;
    }
    i += 1;
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}
