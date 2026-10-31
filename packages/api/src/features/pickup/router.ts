import { pickupVerifyInput, pickupVerifyOutput } from '@repo/contract/pickup';
import { db } from '@repo/db';
import { forbidden, router, scopedProcedure } from '#lib/trpc';
import { parcelScope } from '#lib/access';
import { mayHandOver } from '#features/operating/service';
import { verifyPickup } from '#features/pickup/service';

export const pickupRouter = router({
  verify: scopedProcedure
    .input(pickupVerifyInput)
    .output(pickupVerifyOutput)
    .query(async ({ ctx, input }) => {
      if (!(await mayHandOver(db, ctx.access))) throw forbidden();
      return verifyPickup(
        db,
        ctx.organizationId,
        input,
        new Date(),
        parcelScope(ctx.access),
      );
    }),
});
