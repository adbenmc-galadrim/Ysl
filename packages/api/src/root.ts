import { healthRouter } from '#features/health/router';
import { router } from '#lib/trpc';

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
