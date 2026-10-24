import { pullInput, pushInput, pushOutput } from '@repo/contract/sync';
import { db } from '@repo/db';
import { memberProcedure, router } from '#lib/trpc';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';

export const syncRouter = router({
  pull: memberProcedure
    .input(pullInput)
    .query(({ ctx, input }) => pull(db, ctx.organizationId, input)),
  push: memberProcedure
    .input(pushInput)
    .output(pushOutput)
    .mutation(({ ctx, input }) =>
      push(
        db,
        { organizationId: ctx.organizationId, userId: ctx.session.user.id },
        input,
      ),
    ),
});
