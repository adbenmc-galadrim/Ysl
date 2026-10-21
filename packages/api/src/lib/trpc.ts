import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { initTRPC } from '@trpc/server';

const translate = createTranslator(DEFAULT_LOCALE);

const t = initTRPC.create({
  errorFormatter: ({ shape, error }) =>
    error.code === 'INTERNAL_SERVER_ERROR'
      ? { ...shape, message: translate('error.internal') }
      : shape,
});

export const router = t.router;

export const publicProcedure = t.procedure;
