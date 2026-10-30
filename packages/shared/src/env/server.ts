import '#load-env';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';
import { DEFAULT_DATABASE_URL, SERVER_PORT, WEB_PORT } from '#env/ports';

const isProduction = process.env.NODE_ENV === 'production';

const localOnly = (schema: z.ZodURL, value: string) =>
  isProduction ? schema : schema.default(value);

const DEV_AUTH_SECRET = 'development-only-secret-change-me-0123456789';

export const env = createEnv({
  server: {
    SERVER_PORT: z.coerce.number().default(SERVER_PORT),
    WEB_PORT: z.coerce.number().default(WEB_PORT),
    CORS_ORIGIN: localOnly(z.url(), `http://localhost:${WEB_PORT}`),
    DATABASE_URL: localOnly(z.url(), DEFAULT_DATABASE_URL),
    BETTER_AUTH_SECRET: isProduction
      ? z.string().min(32)
      : z.string().min(32).default(DEV_AUTH_SECRET),
    BETTER_AUTH_URL: localOnly(z.url(), `http://localhost:${SERVER_PORT}`),
    TRUST_PROXY: z.stringbool().default(false),
    /** Minutes between two retention purges (§9.2); 0 turns the job off. */
    PURGE_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(1440),
    /** Without the key or the sender address, the mail job stays off. */
    BREVO_API_KEY: z.string().optional(),
    MAIL_FROM_ADDRESS: z.email().optional(),
    MAIL_FROM_NAME: z.string().default('Courrier'),
    /** Seconds between two drains of the e-mail queue; 0 turns the job off. */
    MAIL_POLL_SECONDS: z.coerce.number().int().min(0).default(30),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .default('info'),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
