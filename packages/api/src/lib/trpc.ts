import type { Session } from '@repo/auth';
import { db } from '@repo/db';
import {
  isCompanyAdmin,
  seesWholeCompany,
  toUserRole,
  type UserRole,
} from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { membershipOf } from '#lib/organization';

const translate = createTranslator(DEFAULT_LOCALE);

export function createTRPCContext({
  headers,
  session,
}: {
  headers: Headers;
  session: Session | null;
}) {
  return { headers, session };
}

export type Context = ReturnType<typeof createTRPCContext>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) =>
    error.code === 'INTERNAL_SERVER_ERROR'
      ? { ...shape, message: translate('error.internal') }
      : shape,
});

export const router = t.router;

export const publicProcedure = t.procedure;

export function forbidden(): TRPCError {
  return new TRPCError({
    code: 'FORBIDDEN',
    message: translate('error.forbidden'),
  });
}

export function roleOf(session: Session): UserRole {
  return toUserRole(session.user.role);
}

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: translate('error.unauthorized'),
    });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** Better Auth's admin API, which ignores companies: closed to `company_admin`. */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (roleOf(ctx.session) !== 'admin') throw forbidden();
  return next();
});

/** Signed in and attached to a company: what every synced table is keyed by. The app admin never is (D26). */
export const memberProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (roleOf(ctx.session) === 'platform_admin') throw forbidden();
  const membership = await membershipOf(db, ctx.session.user.id);
  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: translate('sync.error.noOrganization'),
    });
  }
  return next({ ctx: { ...ctx, ...membership } });
});

/** The data of the whole company, closed to an account that may only see its department. */
export const wholeCompanyProcedure = memberProcedure.use(({ ctx, next }) => {
  if (!seesWholeCompany(roleOf(ctx.session))) throw forbidden();
  return next();
});

/** An admin of the company: the screens of Réglages › Service courrier. */
export const adminMemberProcedure = memberProcedure.use(({ ctx, next }) => {
  if (!isCompanyAdmin(roleOf(ctx.session))) throw forbidden();
  return next();
});
