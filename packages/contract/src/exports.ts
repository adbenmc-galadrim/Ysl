import { z } from 'zod';

/** The mailroom's clock: every date of an export reads in Paris time. */
export const EXPORT_TIME_ZONE = 'Europe/Paris';

export const parcelsCsvOutput = z.object({
  filename: z.string(),
  csv: z.string(),
  count: z.number().int().nonnegative(),
});

export type ParcelsCsvOutput = z.infer<typeof parcelsCsvOutput>;

/** D14: no brand in the name, the day of the export in Paris. */
export function parcelsCsvFilename(now: Date): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return `courrier-historique-${day}.csv`;
}
