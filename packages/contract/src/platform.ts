import { z } from 'zod';

/** Figures only (D26): nothing here may name a company, an account or a recipient. */
export const platformOverviewOutput = z.strictObject({
  companies: z.number().int().nonnegative(),
});

export type PlatformOverviewOutput = z.infer<typeof platformOverviewOutput>;
