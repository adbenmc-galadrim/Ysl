import {
  FAILED_REASON_MAX,
  MAIL_TARGETS,
  type MailMessage,
  type MailTarget,
} from '@repo/contract/mail';
import type { TranslateFn } from '@repo/shared/i18n';
import type { OpenOutcome } from '#/features/mail/mailer';

/** The other two mail apps, offered when `target` did not open. */
export function otherTargets(target: MailTarget): MailTarget[] {
  return MAIL_TARGETS.filter((other) => other !== target);
}

/**
 * The page stayed in front after the tap: the mail app is missing, the
 * link was refused, or it was slow (Gmail in S5). The agent decides.
 */
export function needsFallback(outcome: OpenOutcome): boolean {
  return outcome === 'stayed';
}

/** Subject on the first line, as Outlook reads a shared text (S5), then the body. */
export function mailText({ subject, body }: MailMessage): string {
  return subject ? `${subject}\n\n${body}` : body;
}

export type MailClipboard = Pick<Clipboard, 'writeText'>;

/** False when the browser refused: the text is still on screen to select. */
export async function copyText(
  text: string,
  clipboard: MailClipboard | null = globalThis.navigator?.clipboard ?? null,
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type MailShareOutcome = 'shared' | 'cancelled' | 'unavailable';

type ShareHost = Partial<Pick<Navigator, 'share'>>;

/**
 * The iOS share sheet, with the subject as title and the whole text: the
 * agent picks any app, and types the address there (S5). Closing the sheet
 * is a choice, not a failure.
 */
export async function shareMail(
  message: MailMessage,
  host: ShareHost | undefined = globalThis.navigator,
): Promise<MailShareOutcome> {
  if (!host?.share) return 'unavailable';
  try {
    await host.share({ title: message.subject, text: mailText(message) });
    return 'shared';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unavailable';
  }
}

/** Why a mail was given up, for the log of sent mails (YSL-63). */
export function notOpenedReason(target: MailTarget, t: TranslateFn): string {
  return t('mail.fallback.reason', {
    app: t(`mail.target.${target}`),
  }).slice(0, FAILED_REASON_MAX);
}
