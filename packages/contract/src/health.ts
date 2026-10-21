import { z } from 'zod';

export const serviceState = z.enum(['up', 'down']);

export const healthCheckOutput = z.object({
  api: z.literal('up'),
  database: serviceState,
});

export type HealthCheckOutput = z.infer<typeof healthCheckOutput>;
