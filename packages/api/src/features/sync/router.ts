import { pullInput } from '@repo/contract/sync';
import { db } from '@repo/db';
import { memberProcedure, router } from '#lib/trpc';
import { pull } from '#features/sync/pull';

export const syncRouter = router({
  pull: memberProcedure
    .input(pullInput)
    .query(({ ctx, input }) => pull(db, ctx.organizationId, input)),
});
