import {
  pullInput,
  pullOutput,
  pushInput,
  pushOutput,
} from '@repo/contract/sync';
import { db } from '@repo/db';
import { router, scopedProcedure } from '#lib/trpc';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';

export const syncRouter = router({
  pull: scopedProcedure
    .input(pullInput)
    .output(pullOutput)
    .query(({ ctx, input }) => pull(db, ctx.access, input)),
  push: scopedProcedure
    .input(pushInput)
    .output(pushOutput)
    .mutation(({ ctx, input }) => push(db, ctx.access, input)),
});
