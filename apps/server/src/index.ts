import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { trpcServer } from '@hono/trpc-server';
import {
  appRouter,
  brevoMailer,
  createTRPCContext,
  drainEmailOutbox,
  receiveMailEvent,
  runPurge,
} from '@repo/api';
import { auth, CLIENT_IP_HEADER } from '@repo/auth';
import { closeDb, db, pingDb, withConnection } from '@repo/db';
import { env } from '@repo/shared/env/server';
import { logger } from '@repo/shared/logger';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { authRoutes } from '#auth-routes';
import { clientIp } from '#client-ip';
import { startMailJob } from '#mail-job';
import { mailWebhook } from '#mail-webhook';
import { startPurgeJob } from '#purge-job';
import { requestLog } from '#request-log';

const app = new Hono();

app.use('/*', requestLog);

app.use(
  '/*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
    xFrameOptions: 'DENY',
    strictTransportSecurity: 'max-age=31536000',
    crossOriginResourcePolicy: 'same-origin',
  }),
);

app.use(
  '/*',
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
    maxAge: 86400,
  }),
);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/ready', async (c) => {
  try {
    await pingDb();
    return c.json({ status: 'ready' });
  } catch (error) {
    const { code } = error as Error & { code?: string };
    logger.warn(
      { reason: error instanceof Error ? error.message : String(error), code },
      'readiness check failed',
    );
    return c.json({ status: 'unavailable' }, 503);
  }
});

app.route(
  '/api/auth',
  authRoutes((c) => {
    // The rate limit keys on the socket address, or on the entry appended by the
    // trusted proxy; never on a value the client chose.
    const headers = new Headers(c.req.raw.headers);
    headers.set(
      CLIENT_IP_HEADER,
      clientIp({
        socketAddress: getConnInfo(c).remote.address,
        forwardedFor: c.req.header('x-forwarded-for'),
        trustProxy: env.TRUST_PROXY,
      }),
    );
    return auth.handler(new Request(c.req.raw, { headers }));
  }),
);

app.route(
  '/api/webhooks/mail',
  mailWebhook({
    token: env.BREVO_WEBHOOK_TOKEN,
    receive: (body) => receiveMailEvent(db, body),
  }),
);

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: async (opts) => {
      const headers = opts.req.headers;
      const session = await auth.api
        .getSession({ headers })
        .catch((error: unknown) => {
          logger.warn(
            { reason: error instanceof Error ? error.message : String(error) },
            'session lookup failed',
          );
          return null;
        });
      return createTRPCContext({ headers, session });
    },
    onError: ({ error, path, type }) => {
      const fields = { path, type, code: error.code };
      if (getHTTPStatusCodeFromError(error) >= 500) {
        logger.error({ ...fields, err: error }, 'trpc failed');
      } else {
        logger.warn(fields, 'trpc rejected');
      }
    },
  }),
);

app.onError((error, c) => {
  logger.error({ err: error }, 'unhandled request error');
  return c.json({ error: 'Internal Server Error' }, 500);
});

const server = serve({ fetch: app.fetch, port: env.SERVER_PORT }, (info) => {
  logger.info({ port: info.port }, 'server listening');
});

function startMailerJob(
  apiKey: string,
  fromAddress: string,
): () => Promise<void> {
  const mailer = brevoMailer({
    apiKey,
    from: { email: fromAddress, name: env.MAIL_FROM_NAME },
  });
  return startMailJob({
    intervalSeconds: env.MAIL_POLL_SECONDS,
    run: (signal) => drainEmailOutbox(db, mailer, { signal }),
  });
}

function mailJobOff(): () => Promise<void> {
  logger.warn('mail job off: BREVO_API_KEY or MAIL_FROM_ADDRESS is missing');
  return () => Promise.resolve();
}

const stopPurge = startPurgeJob({
  intervalMinutes: env.PURGE_INTERVAL_MINUTES,
  run: () => withConnection((conn) => runPurge(conn, { trigger: 'auto' })),
});

const stopMail =
  env.BREVO_API_KEY && env.MAIL_FROM_ADDRESS
    ? startMailerJob(env.BREVO_API_KEY, env.MAIL_FROM_ADDRESS)
    : mailJobOff();

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    stopPurge();
    // A send cut short would leave a mail accepted but not recorded: sent twice.
    const mailStopped = stopMail();

    server.close((error) => {
      if (error) logger.error({ err: error }, 'server did not close cleanly');
      void mailStopped
        .then(() => closeDb())
        .catch((cause: unknown) => {
          logger.error({ err: cause }, 'database pool did not close cleanly');
        })
        .finally(() => process.exit(error ? 1 : 0));
    });
  });
}

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled rejection');
  process.exit(1);
});
