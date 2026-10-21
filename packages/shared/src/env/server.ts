import '#load-env';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';
import { DEFAULT_DATABASE_URL, SERVER_PORT, WEB_PORT } from '#env/ports';

const isProduction = process.env.NODE_ENV === 'production';

const localOnly = (schema: z.ZodURL, value: string) =>
  isProduction ? schema : schema.default(value);

export const env = createEnv({
  server: {
    SERVER_PORT: z.coerce.number().default(SERVER_PORT),
    WEB_PORT: z.coerce.number().default(WEB_PORT),
    CORS_ORIGIN: localOnly(z.url(), `http://localhost:${WEB_PORT}`),
    DATABASE_URL: localOnly(z.url(), DEFAULT_DATABASE_URL),
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
