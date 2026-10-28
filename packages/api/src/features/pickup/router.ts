import { pickupVerifyInput, pickupVerifyOutput } from '@repo/contract/pickup';
import { db } from '@repo/db';
import { memberProcedure, router } from '#lib/trpc';
import { verifyPickup } from '#features/pickup/service';

export const pickupRouter = router({
  verify: memberProcedure
    .input(pickupVerifyInput)
    .output(pickupVerifyOutput)
    .query(({ ctx, input }) => verifyPickup(db, ctx.organizationId, input)),
});
