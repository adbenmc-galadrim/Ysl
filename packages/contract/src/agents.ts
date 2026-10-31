import { z } from 'zod';
import { DEFAULT_USER_ROLE, password, userRole } from './auth';

const userId = z.string().min(1);

export const agent = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: userRole,
  active: z.boolean(),
  createdAt: z.string(),
});

export type Agent = z.infer<typeof agent>;

export const listAgentsOutput = z.array(agent);

export const createAgentInput = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password,
  // Never `platform_admin`: this route must not be able to hand it out.
  role: z.enum(['agent', 'admin']).default(DEFAULT_USER_ROLE),
});

export type CreateAgentInput = z.input<typeof createAgentInput>;

export const setAgentActiveInput = z.object({
  userId,
  active: z.boolean(),
});

export const resetAgentPasswordInput = z.object({
  userId,
  password,
});
