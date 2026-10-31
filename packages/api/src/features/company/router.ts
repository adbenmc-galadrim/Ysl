import {
  companySettingsOutput,
  retentionImpact,
  retentionInput,
  saveDepartmentReplyInput,
  saveIdentityInput,
  saveLogoInput,
  saveLogoOutput,
  saveReceptionInput,
  saveRetentionInput,
  saveRetentionOutput,
} from '@repo/contract/company-settings';
import { db } from '@repo/db';
import { department, organization } from '@repo/db/schema';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { removeLogo, saveLogo } from '#features/company/logo';
import { retentionImpactOf, saveRetention } from '#features/company/retention';
import {
  readCompanySettings,
  writeCompanySettings,
} from '#features/company/settings';
import { adminMemberProcedure, router } from '#lib/trpc';

const translate = createTranslator(DEFAULT_LOCALE);

export const companyRouter = router({
  /** Réglages › Identité et e-mails, and Conservation. */
  get: adminMemberProcedure
    .output(companySettingsOutput)
    .query(async ({ ctx }) => {
      const [company] = await db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, ctx.organizationId));
      const settings = await readCompanySettings(db, ctx.organizationId);
      const departments = await db
        .select({
          id: department.id,
          name: department.name,
          replyEmail: department.replyEmail,
        })
        .from(department)
        .where(
          and(
            eq(department.organizationId, ctx.organizationId),
            isNull(department.deletedAt),
          ),
        )
        .orderBy(asc(department.name));
      return {
        name: company?.name ?? '',
        logoId: settings.logoId ?? null,
        reception: settings.reception ?? null,
        retention: settings.retention ?? {},
        departments,
      };
    }),
  saveIdentity: adminMemberProcedure
    .input(saveIdentityInput)
    .mutation(async ({ ctx, input }) => {
      await db
        .update(organization)
        .set({ name: input.name })
        .where(eq(organization.id, ctx.organizationId));
    }),
  saveReception: adminMemberProcedure
    .input(saveReceptionInput)
    .mutation(({ ctx, input }) =>
      writeCompanySettings(
        db,
        ctx.organizationId,
        { reception: input.reception },
        ctx.session.user.id,
      ),
    ),
  saveDepartmentReply: adminMemberProcedure
    .input(saveDepartmentReplyInput)
    .mutation(async ({ ctx, input }) => {
      await db
        .update(department)
        .set({ replyEmail: input.replyEmail, updatedAt: new Date() })
        .where(
          and(
            eq(department.organizationId, ctx.organizationId),
            eq(department.id, input.id),
          ),
        );
    }),
  saveLogo: adminMemberProcedure
    .input(saveLogoInput)
    .output(saveLogoOutput)
    .mutation(async ({ ctx, input }) => {
      const outcome = await saveLogo(
        db,
        ctx.organizationId,
        Buffer.from(input.contentBase64, 'base64'),
        ctx.session.user.id,
      );
      if (typeof outcome === 'string') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: translate(`company.logo.error.${outcome}`),
        });
      }
      return outcome;
    }),
  removeLogo: adminMemberProcedure.mutation(({ ctx }) =>
    removeLogo(db, ctx.organizationId, ctx.session.user.id),
  ),
  /** The rows a change would take, announced before anything is saved. */
  previewRetention: adminMemberProcedure
    .input(retentionInput)
    .output(retentionImpact)
    .query(({ ctx, input }) =>
      retentionImpactOf(db, ctx.organizationId, input.retention, new Date()),
    ),
  saveRetention: adminMemberProcedure
    .input(saveRetentionInput)
    .output(saveRetentionOutput)
    .mutation(async ({ ctx, input }) => {
      const outcome = await saveRetention(
        db,
        ctx.organizationId,
        input,
        ctx.session.user.id,
      );
      if (outcome.status === 'refused') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: translate(`company.retention.error.${outcome.problem}`),
        });
      }
      return outcome;
    }),
});
