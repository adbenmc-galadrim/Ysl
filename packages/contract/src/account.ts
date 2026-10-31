import { z } from 'zod';
import { userRole } from './auth';

export const accountMeOutput = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: userRole,
});

export type AccountMeOutput = z.infer<typeof accountMeOutput>;

/** The company of the account, which the desktop sidebar names. */
export const accountCompanyOutput = z.object({ name: z.string() });
