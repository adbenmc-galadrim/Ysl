import {
  pullInput,
  pullOutput,
  pushInput,
  pushOutput,
} from '@repo/contract/sync';
import { db } from '@repo/db';
import { serverMailEnabled } from '#features/mail/config';
import { router, scopedProcedure } from '#lib/trpc';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';

export const syncRouter = router({
  pull: scopedProcedure
    .input(pullInput)
    .output(pullOutput)
    .query(async ({ ctx, input }) => ({
      ...(await pull(db, ctx.access, input)),
      serverMail: serverMailEnabled(),
    })),
  push: scopedProcedure
    .input(pushInput)
    .output(pushOutput)
    .mutation(({ ctx, input }) => push(db, ctx.access, input)),
});
