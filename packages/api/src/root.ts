import { accountRouter } from '#features/account/router';
import { agentsRouter } from '#features/agents/router';
import { healthRouter } from '#features/health/router';
import { router } from '#lib/trpc';

export const appRouter = router({
  account: accountRouter,
  agents: agentsRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
