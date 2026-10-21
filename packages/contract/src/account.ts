import { z } from 'zod';
import { userRole } from './auth';

export const accountMeOutput = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: userRole,
});

export type AccountMeOutput = z.infer<typeof accountMeOutput>;
