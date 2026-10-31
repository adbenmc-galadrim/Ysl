import type { LinkDelivery } from '@repo/contract/accounts';
import { INVITATION_DAYS } from '@repo/contract/accounts';
import { toUserRole } from '@repo/contract/auth';
import type { AnyDb } from '@repo/db';
import { organization } from '@repo/db/schema';
import { env } from '@repo/shared/env/server';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { logger } from '@repo/shared/logger';
import { eq } from 'drizzle-orm';
import { brevoMailer } from '#features/mail/brevo';
import type { Mailer } from '#features/mail/mailer';
import { sendFrom } from '#features/mail/queue';
import { senderOf } from '#features/mail/sender';
import { escapeHtml } from '#features/mail/server-send';
import { linkTo } from '#features/invitations/link';

const translate = createTranslator(DEFAULT_LOCALE);

/** Needs no webhook, unlike the parcels' mails: a link that does not arrive is sent again by hand. */
function configuredMailer(): Mailer | null {
  return env.BREVO_API_KEY && env.MAIL_FROM_ADDRESS
    ? brevoMailer({
        apiKey: env.BREVO_API_KEY,
        from: { email: env.MAIL_FROM_ADDRESS, name: env.MAIL_FROM_NAME },
      })
    : null;
}

export type LinkMessage = {
  organizationId: string;
  name: string;
  email: string;
  role: string | null;
  /** No password yet, or one being replaced. */
  kind: 'invite' | 'reset';
  /** Left out when the app's admin invites: its name is no business of the company's. */
  invitedBy?: string;
};

function compose(message: LinkMessage, company: string, link: string) {
  const role = toUserRole(message.role);
  const shared = {
    company,
    role: role ? translate(`auth.role.${role}`) : '',
    days: INVITATION_DAYS,
    email: message.email,
  };
  const subject = translate(`invitations.mail.${message.kind}.subject`, shared);
  const lead =
    message.kind === 'invite' && message.invitedBy
      ? translate('invitations.mail.invite.leadBy', {
          ...shared,
          name: message.invitedBy,
        })
      : translate(`invitations.mail.${message.kind}.lead`, shared);
  const action = translate(`invitations.mail.${message.kind}.action`);
  const validity = translate('invitations.mail.validity', shared);
  const ignore = translate('invitations.mail.ignore');
  return {
    subject,
    text: [lead, `${action} : ${link}`, validity, ignore].join('\n\n'),
    html: [
      `<p><strong>${escapeHtml(company)}</strong></p>`,
      `<p>${escapeHtml(lead)}</p>`,
      `<p><a href="${escapeHtml(link)}">${escapeHtml(action)}</a></p>`,
      `<p>${escapeHtml(validity)}</p>`,
      `<p>${escapeHtml(ignore)}</p>`,
    ].join(''),
  };
}

/**
 * Sent at once rather than through the queue, whose rows hold their text: the
 * token never reaches the database. Whatever stops the mail, the admin gets the
 * link, otherwise a server without a provider could create no account.
 */
export async function deliverLink(
  db: AnyDb,
  message: LinkMessage,
  { token, expiresAt }: { token: string; expiresAt: Date },
  { copy = false, mailer = configuredMailer() } = {},
): Promise<LinkDelivery> {
  const link = linkTo(token);
  if (copy) return { delivery: 'copy', reason: 'asked', link, expiresAt };
  if (!mailer) return { delivery: 'copy', reason: 'off', link, expiresAt };
  try {
    const [company] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, message.organizationId));
    const result = await sendFrom(
      mailer,
      {
        idempotencyKey: newId(),
        to: message.email,
        toName: message.name,
        ...compose(message, company?.name ?? '', link),
      },
      await senderOf(db, message.organizationId),
    );
    if (result.status === 'sent') return { delivery: 'sent', expiresAt };
    logger.warn({ reason: result.reason }, 'account link not sent');
  } catch (error) {
    logger.warn(
      { reason: error instanceof Error ? error.name : 'error' },
      'account link not sent',
    );
  }
  return { delivery: 'copy', reason: 'failed', link, expiresAt };
}
