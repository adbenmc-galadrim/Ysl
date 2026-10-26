import { accountRouter } from '#features/account/router';
import { agentsRouter } from '#features/agents/router';
import { exportsRouter } from '#features/exports/router';
import { healthRouter } from '#features/health/router';
import { importsRouter } from '#features/imports/router';
import { syncRouter } from '#features/sync/router';
import { router } from '#lib/trpc';

export const appRouter = router({
  account: accountRouter,
  agents: agentsRouter,
  exports: exportsRouter,
  health: healthRouter,
  imports: importsRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
