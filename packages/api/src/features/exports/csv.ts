/** Excel reads UTF-8 only when the file opens with a byte order mark. */
export const BOM = '﻿';

const SEPARATOR = ';';
const NEWLINE = '\r\n';

/** §9: a cell Excel would run as a formula; tab and carriage return too (OWASP). */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[";\n\r]/;
const DIGITS = /^\d+$/;

/** A code Excel must not read as a number; see `textCell`. */
export type CsvText = { text: string };

export type CsvCell = string | CsvText | null | undefined;

/**
 * A tracking or reference made of digits only: Excel would drop its leading
 * zeros and print 12 digits and more in scientific notation. `="…"` keeps it
 * as typed; digits only, so nothing but the code itself can run.
 */
export function textCell(value: string | null): CsvCell {
  return value && DIGITS.test(value) ? { text: value } : value;
}

/** One cell as Excel reads it: never a formula, quoted when it holds a separator. */
export function csvCell(value: CsvCell): string {
  if (!value) return '';
  if (typeof value !== 'string') {
    return DIGITS.test(value.text)
      ? `"=""${value.text}"""`
      : csvCell(value.text);
  }
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** A whole file: BOM, header line, one line per row, `\r\n` after each. */
export function toCsv(header: readonly string[], rows: readonly CsvCell[][]) {
  const lines = [header, ...rows].map((cells) =>
    cells.map(csvCell).join(SEPARATOR),
  );
  return BOM + lines.map((line) => line + NEWLINE).join('');
}
