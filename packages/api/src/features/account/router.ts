import {
  accountCompanyOutput,
  accountMeOutput,
} from '@repo/contract/account';
import { db } from '@repo/db';
import { memberProcedure, protectedProcedure, router } from '#lib/trpc';
import { companyOf, getAccount } from '#features/account/service';

export const accountRouter = router({
  me: protectedProcedure
    .output(accountMeOutput)
    .query(({ ctx }) => getAccount(ctx.session)),
  company: memberProcedure
    .output(accountCompanyOutput)
    .query(({ ctx }) => companyOf(db, ctx.organizationId)),
});
