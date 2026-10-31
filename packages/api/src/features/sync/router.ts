import {
  pullInput,
  pullOutput,
  pushInput,
  pushOutput,
} from '@repo/contract/sync';
import { db } from '@repo/db';
import { router, wholeCompanyProcedure } from '#lib/trpc';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';

export const syncRouter = router({
  pull: wholeCompanyProcedure
    .input(pullInput)
    .output(pullOutput)
    .query(({ ctx, input }) => pull(db, ctx.access, input)),
  push: wholeCompanyProcedure
    .input(pushInput)
    .output(pushOutput)
    .mutation(({ ctx, input }) => push(db, ctx.access, input)),
});
