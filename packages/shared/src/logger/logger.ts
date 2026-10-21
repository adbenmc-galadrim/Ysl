import { createRequire } from 'node:module';
import { pino } from 'pino';
import { env } from '#env/server';
import { getRequestContext } from '#logger/context';

function prettyTransport() {
  if (env.NODE_ENV !== 'development') return undefined;

  try {
    createRequire(import.meta.url).resolve('pino-pretty');
  } catch {
    return undefined;
  }

  return {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'HH:MM:ss' },
  };
}

export const logger = pino({
  level: env.LOG_LEVEL,
  mixin: () => ({ ...getRequestContext() }),
  redact: {
    paths: ['cookie', 'authorization', '*.cookie', '*.authorization'],
    censor: '[redacted]',
  },
  transport: prettyTransport(),
});

export type Logger = typeof logger;
