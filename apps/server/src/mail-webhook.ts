import { isWebhookAuthorized, WEBHOOK_STATUS } from '@repo/api';
import type { WebhookStatus } from '@repo/api';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export type MailWebhookOptions = {
  /** Without it the route answers 404: no event is expected. */
  token: string | undefined;
  receive: (body: unknown) => Promise<WebhookStatus>;
};

/** Where the provider tells what became of each mail (ME02). */
export function mailWebhook({ token, receive }: MailWebhookOptions): Hono {
  const route = new Hono();
  route.post('/', bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
    if (!token) return c.body(null, 404);
    if (!isWebhookAuthorized(c.req.header('authorization'), token)) {
      return c.body(null, WEBHOOK_STATUS.unauthorized);
    }
    const body: unknown = await c.req.json().catch(() => null);
    return c.body(null, await receive(body));
  });
  return route;
}
