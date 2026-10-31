import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';

const t = createTranslator(DEFAULT_LOCALE);

const SHOWN = new Set(['CONFLICT', 'NOT_FOUND', 'BAD_REQUEST']);

/** The server's own words when it refused; nothing technical otherwise. */
export function platformErrorMessage(error: unknown): string {
  const { message, data } = error as {
    message?: string;
    data?: { code?: string };
  };
  return message && data?.code && SHOWN.has(data.code)
    ? message
    : t('platform.error.save');
}
