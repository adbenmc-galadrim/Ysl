import { accountsRouter } from '#features/accounts/router';
import { accountRouter } from '#features/account/router';
import { companyRouter } from '#features/company/router';
import { departmentsRouter } from '#features/departments/router';
import { devicesRouter } from '#features/devices/router';
import { directoryRouter } from '#features/directory/router';
import { exportsRouter } from '#features/exports/router';
import { healthRouter } from '#features/health/router';
import { importsRouter } from '#features/imports/router';
import { invitationsRouter } from '#features/invitations/router';
import { mailSenderRouter } from '#features/mail/router';
import { maintenanceRouter } from '#features/maintenance/router';
import { operatingRouter } from '#features/operating/router';
import { pickupRouter } from '#features/pickup/router';
import { platformRouter } from '#features/platform/router';
import { syncRouter } from '#features/sync/router';
import { tourRouter } from '#features/tour/router';
import { router } from '#lib/trpc';

export const appRouter = router({
  account: accountRouter,
  accounts: accountsRouter,
  company: companyRouter,
  departments: departmentsRouter,
  devices: devicesRouter,
  directory: directoryRouter,
  exports: exportsRouter,
  health: healthRouter,
  imports: importsRouter,
  invitations: invitationsRouter,
  mailSender: mailSenderRouter,
  maintenance: maintenanceRouter,
  operating: operatingRouter,
  pickup: pickupRouter,
  platform: platformRouter,
  sync: syncRouter,
  tour: tourRouter,
});

export type AppRouter = typeof appRouter;
