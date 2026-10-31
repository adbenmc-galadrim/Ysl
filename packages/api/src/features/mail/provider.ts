import { env } from '@repo/shared/env/server';
import { brevoDomains } from '#features/mail/brevo';
import type { MailDomains } from '#features/mail/mailer';

/** The mail job needs both: without the address, nothing would leave. */
export function mailDomainProvider(): MailDomains | null {
  return env.BREVO_API_KEY && env.MAIL_FROM_ADDRESS
    ? brevoDomains({ apiKey: env.BREVO_API_KEY })
    : null;
}
