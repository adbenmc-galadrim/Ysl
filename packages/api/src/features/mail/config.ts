import { env } from '@repo/shared/env/server';

/**
 * Whether the mail job runs here. Told to the devices by `sync.pull`: without
 * it, an iPhone writes no request and the agent's mail app does the work.
 */
export function serverMailEnabled(): boolean {
  return Boolean(
    env.BREVO_API_KEY && env.MAIL_FROM_ADDRESS && env.MAIL_POLL_SECONDS > 0,
  );
}
