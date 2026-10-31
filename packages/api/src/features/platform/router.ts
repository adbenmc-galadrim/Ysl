import { accountStanding, createCompany } from '@repo/auth/organization';
import {
  accountSuspensionInput,
  accountSuspensionOutput,
  companyInput,
  createCompanyInput,
  deleteCompanyInput,
  journalInput,
  journalOutput,
  platformCompanies,
  platformCompanyDetail,
  platformOverviewOutput,
  renameCompanyInput,
} from '@repo/contract/platform';
import { db } from '@repo/db';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';
import { mailDomainProvider } from '#features/mail/provider';
import {
  readJournal,
  recordPlatformAction,
} from '#features/platform/journal';
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
    .mutation(async ({ ctx, input }) => {
      if (await companyNameTaken(db, input.name)) throw nameTaken();
      const id = await db.transaction(async (tx) => {
        const created = await createCompany(tx, input);
        await recordPlatformAction(
          tx,
          ctx.session.user,
          { id: created, name: input.name },
          'company_created',
          { profileModel: input.profileModel },
        );
        return created;
      });
      return { id };
    }),
  renameCompany: platformProcedure
    .input(renameCompanyInput)
    .output(companyInput)
    .mutation(async ({ ctx, input }) => {
      if (await companyNameTaken(db, input.name, input.id)) throw nameTaken();
      if (!(await renameCompany(db, input.id, input.name, ctx.session.user))) {
        throw notFound();
      }
      return { id: input.id };
    }),
  suspendCompany: platformProcedure
    .input(companyInput)
    .output(companyInput)
    .mutation(async ({ ctx, input }) => {
      const found = await setCompanySuspended(
        db,
        input.id,
        true,
        ctx.session.user,
      );
      if (!found) throw notFound();
      return { id: input.id };
    }),
  reactivateCompany: platformProcedure
    .input(companyInput)
    .output(companyInput)
    .mutation(async ({ ctx, input }) => {
      const found = await setCompanySuspended(
        db,
        input.id,
        false,
        ctx.session.user,
      );
      if (!found) throw notFound();
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
      const purged = await db.transaction(async (tx) => {
        const rows = await purgeCompanyRows(tx, input.id);
        if (rows) {
          await recordPlatformAction(
            tx,
            ctx.session.user,
            company,
            'company_deleted',
            {
              accounts: company.accounts,
              departments: company.departments,
              parcels: company.parcels,
            },
          );
        }
        return rows;
      });
      if (!purged) throw notFound();
      await releaseCompanyDomain(purged.domain, mailDomainProvider());
      return { id: input.id };
    }),
  journal: platformProcedure
    .input(journalInput)
    .output(journalOutput)
    .query(({ input }) => readJournal(db, input)),
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
