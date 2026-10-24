import type { Session } from '@repo/auth';
import { db } from '@repo/db';
import { toUserRole, type UserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { organizationOf } from '#lib/organization';

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

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (roleOf(ctx.session) !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: translate('error.forbidden'),
    });
  }
  return next();
});

/** Signed in and attached to a mailroom: what every synced table is keyed by. */
export const memberProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const organizationId = await organizationOf(db, ctx.session.user.id);
  if (!organizationId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: translate('sync.error.noOrganization'),
    });
  }
  return next({ ctx: { ...ctx, organizationId } });
});
