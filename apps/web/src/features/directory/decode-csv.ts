/**
 * The text of a CSV file: UTF-8 when it is valid, else what Excel writes on
 * Windows. Read blindly as UTF-8, « Prénom » would no longer name its column
 * and « Lefèvre » would overwrite a card with a broken letter.
 */
export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
