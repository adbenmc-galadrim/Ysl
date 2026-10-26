import type { ParcelsCsvOutput } from '@repo/contract/exports';

/** The server's text as a file the share sheet hands to Fichiers, Mail or Excel. */
export function csvFile({ filename, csv }: ParcelsCsvOutput): File {
  return new File([csv], filename, { type: 'text/csv;charset=utf-8' });
}
