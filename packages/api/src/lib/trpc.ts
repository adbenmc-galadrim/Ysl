import type { Session } from '@repo/auth';
import { db } from '@repo/db';
import { isCompanyAdmin, toUserRole, type UserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Access } from '#lib/access';
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
  const role = toUserRole(session.user.role);
  if (!role) throw forbidden();
  return role;
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

/** The app admin: outside every company, so a company account promoted by mistake stays refused (D26). */
export const platformProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (roleOf(ctx.session) !== 'platform_admin') throw forbidden();
    if (await membershipOf(db, ctx.session.user.id)) throw forbidden();
    return next();
  },
);

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

/** The data of the company as this role reaches it (`parcelScope`); a department account attached nowhere has none. */
export const scopedProcedure = memberProcedure.use(({ ctx, next }) => {
  const role = roleOf(ctx.session);
  if (role === 'department' && !ctx.departmentId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: translate('sync.error.noDepartment'),
    });
  }
  const access: Access = {
    organizationId: ctx.organizationId,
    userId: ctx.session.user.id,
    role,
    departmentId: ctx.departmentId,
  };
  return next({ ctx: { ...ctx, access } });
});

/** A department account, on its own people. */
export const departmentProcedure = scopedProcedure.use(({ ctx, next }) => {
  if (ctx.access.role !== 'department') throw forbidden();
  return next();
});

/** Who tends a directory (D15 révisée): a department its own, the company admin all of them. */
export const directoryKeeperProcedure = scopedProcedure.use(({ ctx, next }) => {
  const { role } = ctx.access;
  if (role !== 'department' && !isCompanyAdmin(role)) throw forbidden();
  return next();
});

/** An admin of the company: the screens of Réglages › Service courrier. */
export const adminMemberProcedure = memberProcedure.use(({ ctx, next }) => {
  if (!isCompanyAdmin(roleOf(ctx.session))) throw forbidden();
  return next();
});
