import { canHandOver } from '@repo/contract/auth';
import { pickupVerifyInput, pickupVerifyOutput } from '@repo/contract/pickup';
import { db } from '@repo/db';
import { forbidden, router, scopedProcedure } from '#lib/trpc';
import { parcelScope } from '#lib/access';
import { verifyPickup } from '#features/pickup/service';

export const pickupRouter = router({
  verify: scopedProcedure
    .input(pickupVerifyInput)
    .output(pickupVerifyOutput)
    .query(({ ctx, input }) => {
      if (!canHandOver(ctx.access.role)) throw forbidden();
      return verifyPickup(
        db,
        ctx.organizationId,
        input,
        new Date(),
        parcelScope(ctx.access),
      );
    }),
});
