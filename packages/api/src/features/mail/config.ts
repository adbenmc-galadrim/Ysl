import { env } from '@repo/shared/env/server';

/**
 * Whether the devices ask the server for their mails, told by `sync.pull`. The
 * webhook counts: without it, no bounce or unsubscribe would ever come back. No
 * yes, and an iPhone writes no request: the agent's mail app does the work.
 */
export function serverMailEnabled(): boolean {
  return Boolean(
    env.BREVO_API_KEY &&
    env.BREVO_WEBHOOK_TOKEN &&
    env.MAIL_FROM_ADDRESS &&
    env.MAIL_POLL_SECONDS > 0,
  );
}
