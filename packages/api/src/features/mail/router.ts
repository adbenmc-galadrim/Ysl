import { saveSenderInput, senderSettings } from '@repo/contract/mail';
import { db } from '@repo/db';
import { env } from '@repo/shared/env/server';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';
import { brevoDomains } from '#features/mail/brevo';
import {
  checkSender,
  getSender,
  saveSender,
  type SenderContext,
} from '#features/mail/sender';
import { adminMemberProcedure, router } from '#lib/trpc';

const translate = createTranslator(DEFAULT_LOCALE);

function context(): SenderContext {
  return {
    // The mail job needs both: without the address, nothing would leave.
    provider:
      env.BREVO_API_KEY && env.MAIL_FROM_ADDRESS
        ? brevoDomains({ apiKey: env.BREVO_API_KEY })
        : null,
    platformAddress: env.MAIL_FROM_ADDRESS ?? null,
  };
}

export const mailSenderRouter = router({
  /** Réglages › Expéditeur des e-mails: the address, its domain, the DNS records. */
  get: adminMemberProcedure
    .output(senderSettings)
    .query(({ ctx }) => getSender(db, ctx.organizationId, context())),
  save: adminMemberProcedure
    .input(saveSenderInput)
    .output(senderSettings)
    .mutation(async ({ ctx, input }) => {
      const outcome = await saveSender(
        db,
        {
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          input,
        },
        context(),
      );
      if (outcome === 'taken') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: translate('sender.error.taken'),
        });
      }
      if (outcome === 'platform' || outcome === 'invalid') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: translate(`sender.error.${outcome}`),
        });
      }
      return outcome;
    }),
  /** "Vérifier maintenant": asks the provider whether the DNS is in place. */
  check: adminMemberProcedure
    .output(senderSettings)
    .mutation(({ ctx }) =>
      checkSender(db, { organizationId: ctx.organizationId }, context()),
    ),
});
