/** Excel reads UTF-8 only when the file opens with a byte order mark. */
export const BOM = '\uFEFF';

const SEPARATOR = ';';
const NEWLINE = '\r\n';

/** §9: a cell Excel would run as a formula; tab and carriage return too (OWASP). */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[";\n\r]/;

export type CsvCell = string | null | undefined;

/** One cell as Excel reads it: never a formula, quoted when it holds a separator. */
export function csvCell(value: CsvCell): string {
  if (!value) return '';
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
