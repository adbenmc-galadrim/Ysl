import { platformOverviewOutput } from '@repo/contract/platform';
import { db } from '@repo/db';
import { platformProcedure, router } from '#lib/trpc';
import { getPlatformOverview } from '#features/platform/service';

export const platformRouter = router({
  overview: platformProcedure
    .output(platformOverviewOutput)
    .query(() => getPlatformOverview(db)),
});
