import {
  accountRecord,
  accountTargetInput,
  createAccountInput,
  listAccountsInput,
  listAccountsOutput,
  reinstateAccountInput,
  resetAccountPasswordInput,
  setAccountRoleInput,
} from '@repo/contract/accounts';
import { db } from '@repo/db';
import { adminMemberProcedure, router } from '#lib/trpc';
import {
  createAccount,
  getAccountRecord,
  listAccounts,
  reinstateAccount,
  resetAccountPassword,
  revokeAccount,
  setAccountRole,
  suspendAccount,
} from '#features/accounts/service';

/** The accounts of one company, for its admin; the platform's accounts are never in it. */
export const accountsRouter = router({
  list: adminMemberProcedure
    .input(listAccountsInput)
    .output(listAccountsOutput)
    .query(({ ctx, input }) => listAccounts(db, ctx.organizationId, input)),
  get: adminMemberProcedure
    .input(accountTargetInput)
    .output(accountRecord)
    .query(({ ctx, input }) =>
      getAccountRecord(db, ctx.organizationId, input.userId),
    ),
  create: adminMemberProcedure
    .input(createAccountInput)
    .output(accountRecord)
    .mutation(({ ctx, input }) => createAccount(db, ctx.organizationId, input)),
  setRole: adminMemberProcedure
    .input(setAccountRoleInput)
    .mutation(({ ctx, input }) =>
      setAccountRole(db, ctx.organizationId, input),
    ),
  suspend: adminMemberProcedure
    .input(accountTargetInput)
    .mutation(({ ctx, input }) =>
      suspendAccount(db, ctx.organizationId, input.userId),
    ),
  revoke: adminMemberProcedure
    .input(accountTargetInput)
    .mutation(({ ctx, input }) =>
      revokeAccount(db, ctx.organizationId, input.userId),
    ),
  reinstate: adminMemberProcedure
    .input(reinstateAccountInput)
    .mutation(({ ctx, input }) =>
      reinstateAccount(db, ctx.organizationId, input),
    ),
  resetPassword: adminMemberProcedure
    .input(resetAccountPasswordInput)
    .mutation(({ ctx, input }) =>
      resetAccountPassword(db, ctx.organizationId, input),
    ),
});
