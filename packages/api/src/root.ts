import { accountRouter } from '#features/account/router';
import { agentsRouter } from '#features/agents/router';
import { devicesRouter } from '#features/devices/router';
import { exportsRouter } from '#features/exports/router';
import { healthRouter } from '#features/health/router';
import { importsRouter } from '#features/imports/router';
import { maintenanceRouter } from '#features/maintenance/router';
import { pickupRouter } from '#features/pickup/router';
import { syncRouter } from '#features/sync/router';
import { router } from '#lib/trpc';

export const appRouter = router({
  account: accountRouter,
  agents: agentsRouter,
  devices: devicesRouter,
  exports: exportsRouter,
  health: healthRouter,
  imports: importsRouter,
  maintenance: maintenanceRouter,
  pickup: pickupRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
