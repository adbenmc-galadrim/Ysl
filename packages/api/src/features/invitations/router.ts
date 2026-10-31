import { mustChangePassword } from '@repo/contract/auth';
import {
  acceptInvitationInput,
  changeRequiredPasswordInput,
  inspectInvitationInput,
  invitationView,
  inviteCompanyAdminInput,
  linkDelivery,
} from '@repo/contract/accounts';
import { db } from '@repo/db';
import {
  acceptInvitation,
  changeRequiredPassword,
  inspectInvitation,
  inviteCompanyAdmin,
} from '#features/invitations/service';
import {
  forbidden,
  platformProcedure,
  publicProcedure,
  router,
  signedInProcedure,
} from '#lib/trpc';

/** Both public ones are mutations, even the read: a query would put the token in a URL. */
export const invitationsRouter = router({
  inspect: publicProcedure
    .input(inspectInvitationInput)
    .output(invitationView)
    .mutation(({ input }) => inspectInvitation(db, input.token)),
  accept: publicProcedure
    .input(acceptInvitationInput)
    .mutation(({ input }) => acceptInvitation(db, input)),
  changeRequiredPassword: signedInProcedure
    .input(changeRequiredPasswordInput)
    .mutation(({ ctx, input }) => {
      // Asks no current password: this session has just proved it, and only this one may skip it.
      if (!mustChangePassword(ctx.session)) throw forbidden();
      return changeRequiredPassword(db, ctx.session.user.id, input.password);
    }),
  inviteCompanyAdmin: platformProcedure
    .input(inviteCompanyAdminInput)
    .output(linkDelivery)
    .mutation(({ ctx, input }) =>
      inviteCompanyAdmin(db, input, ctx.session.user),
    ),
});
