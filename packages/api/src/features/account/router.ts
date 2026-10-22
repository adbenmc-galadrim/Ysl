import { accountMeOutput } from '@repo/contract/account';
import { protectedProcedure, router } from '#lib/trpc';
import { getAccount } from '#features/account/service';

export const accountRouter = router({
  me: protectedProcedure
    .output(accountMeOutput)
    .query(({ ctx }) => getAccount(ctx.session)),
});
