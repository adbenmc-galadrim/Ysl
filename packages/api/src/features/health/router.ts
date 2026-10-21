import { healthCheckOutput } from '@repo/contract/health';
import { healthCheck } from '#features/health/service';
import { publicProcedure, router } from '#lib/trpc';

export const healthRouter = router({
  check: publicProcedure.output(healthCheckOutput).query(() => healthCheck()),
});
