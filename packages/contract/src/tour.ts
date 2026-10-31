import { z } from 'zod';

/** How many parcels are on no shuttle's tour, or were just taken on. */
export const tourParcelsOutput = z.object({ parcels: z.number() });

export type TourParcelsOutput = z.infer<typeof tourParcelsOutput>;
