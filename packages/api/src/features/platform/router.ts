import { accountStanding, createCompany } from '@repo/auth/organization';
import {
  accountSuspensionInput,
  accountSuspensionOutput,
  companyInput,
  createCompanyInput,
  deleteCompanyInput,
  platformCompanies,
  platformCompanyDetail,
  platformOverviewOutput,
  renameCompanyInput,
} from '@repo/contract/platform';
import { db } from '@repo/db';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { logger } from '@repo/shared/logger';
import { TRPCError } from '@trpc/server';
import { mailDomainProvider } from '#features/mail/provider';
import {
  purgeCompanyRows,
  releaseCompanyDomain,
} from '#features/platform/purge-company';
import {
  companyNameTaken,
  getCompany,
  getPlatformOverview,
  listCompanies,
  renameCompany,
  setCompanySuspended,
} from '#features/platform/service';
import { platformProcedure, publicProcedure, router } from '#lib/trpc';

const translate = createTranslator(DEFAULT_LOCALE);

const notFound = () =>
  new TRPCError({
    code: 'NOT_FOUND',
    message: translate('platform.error.notFound'),
  });

const nameTaken = () =>
  new TRPCError({
    code: 'CONFLICT',
    message: translate('platform.error.nameTaken'),
  });

export const platformRouter = router({
  overview: platformProcedure
    .output(platformOverviewOutput)
    .query(() => getPlatformOverview(db)),
  companies: platformProcedure
    .output(platformCompanies)
    .query(() => listCompanies(db)),
  company: platformProcedure
    .input(companyInput)
    .output(platformCompanyDetail)
    .query(async ({ input }) => {
      const company = await getCompany(db, input.id);
      if (!company) throw notFound();
      return company;
    }),
  createCompany: platformProcedure
    .input(createCompanyInput)
    .output(companyInput)
    .mutation(async ({ input }) => {
      if (await companyNameTaken(db, input.name)) throw nameTaken();
      return { id: await createCompany(db, input) };
    }),
  renameCompany: platformProcedure
    .input(renameCompanyInput)
    .output(companyInput)
    .mutation(async ({ input }) => {
      if (await companyNameTaken(db, input.name, input.id)) throw nameTaken();
      if (!(await renameCompany(db, input.id, input.name))) throw notFound();
      return { id: input.id };
    }),
  suspendCompany: platformProcedure
    .input(companyInput)
    .output(companyInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await setCompanySuspended(db, input.id, true))) throw notFound();
      logger.info(
        { companyId: input.id, by: ctx.session.user.id },
        'company suspended',
      );
      return { id: input.id };
    }),
  reactivateCompany: platformProcedure
    .input(companyInput)
    .output(companyInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await setCompanySuspended(db, input.id, false))) throw notFound();
      logger.info(
        { companyId: input.id, by: ctx.session.user.id },
        'company reactivated',
      );
      return { id: input.id };
    }),
  deleteCompany: platformProcedure
    .input(deleteCompanyInput)
    .output(companyInput)
    .mutation(async ({ ctx, input }) => {
      const company = await getCompany(db, input.id);
      if (!company) throw notFound();
      if (input.confirmName.trim() !== company.name) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: translate('platform.error.confirmName'),
        });
      }
      const purged = await purgeCompanyRows(db, input.id);
      if (!purged) throw notFound();
      logger.info(
        { companyId: input.id, by: ctx.session.user.id },
        'company deleted',
      );
      await releaseCompanyDomain(purged.domain, mailDomainProvider());
      return { id: input.id };
    }),
  /**
   * Asked by a phone the auth server just told it has no session, before it
   * empties itself. No session to check, hence public; it gives one word, about
   * an id nobody can guess, and nothing that names anyone.
   */
  accountSuspension: publicProcedure
    .input(accountSuspensionInput)
    .output(accountSuspensionOutput)
    .query(({ input }) => accountStanding(db, input.userId)),
});
