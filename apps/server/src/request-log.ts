import { randomUUID } from 'node:crypto';
import { logger, runWithRequestContext } from '@repo/shared/logger';
import type { MiddlewareHandler } from 'hono';

export const requestLog: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  const start = performance.now();

  await runWithRequestContext({ requestId }, async () => {
    await next();
    logger.debug(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      'request',
    );
  });
};
