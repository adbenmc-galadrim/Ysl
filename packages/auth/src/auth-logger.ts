import { logger } from '@repo/shared/logger';
import type { BetterAuthOptions } from 'better-auth';

export const authLogger = {
  level: 'debug',
  log: (level, message, ...args) => {
    const [first, ...rest] = args as unknown[];
    const isError = first instanceof Error;
    const extra = isError ? rest : args;

    logger[level](
      {
        ...(isError && { err: first }),
        ...(extra.length > 0 && { args: extra }),
      },
      message,
    );
  },
} satisfies NonNullable<BetterAuthOptions['logger']>;
