import { tourParcelsOutput } from '@repo/contract/tour';
import { db } from '@repo/db';
import { forbidden, router, scopedProcedure } from '#lib/trpc';
import { claimUnclaimed, countUnclaimed } from '#features/tour/service';

/** A shuttle of a company that runs tours; anyone else has no tour to take them on. */
const shuttleOnTourProcedure = scopedProcedure.use(({ ctx, next }) => {
  if (!ctx.access.onTour) throw forbidden();
  return next();
});

export const tourRouter = router({
  unclaimed: shuttleOnTourProcedure
    .output(tourParcelsOutput)
    .query(async ({ ctx }) => ({
      parcels: await countUnclaimed(db, ctx.organizationId),
    })),
  claim: shuttleOnTourProcedure
    .output(tourParcelsOutput)
    .mutation(async ({ ctx }) => ({
      parcels: await claimUnclaimed(db, ctx.organizationId, ctx.access.userId),
    })),
});
