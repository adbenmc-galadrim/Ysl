import type { MailMessage, MailTarget } from '@repo/contract/mail';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { MailFallbackSheet } from '@repo/ui';
import { useRef, useState, type MouseEvent } from 'react';
import {
  copyText,
  mailText,
  notOpenedHint,
  notOpenedReason,
  otherTargets,
  shareMail,
} from '#/features/mail/fallback';
import { MAILERS } from '#/features/mail/mailer';
import type { SentResult } from '#/features/mail/notifications';
import { useNotifications } from '#/features/mail/use-notifications';

const t = createTranslator(DEFAULT_LOCALE);

export type MailFallbackProps = {
  message: MailMessage;
  /** The mail app that did not open. */
  target: MailTarget;
  /** The mail on record, if any: without it (a test) the sheet only closes. */
  notificationId?: string;
  /** Another app took over: the caller asks whether it left, as after "Envoyer". */
  onOpened?: (target: MailTarget) => void;
  onSent?: (result: SentResult) => void;
  onAbandoned?: () => void;
  onClose?: () => void;
};

/**
 * The sheet after a tap that left the page in front. Each other app is a
 * real link, opened by the tap; the text goes to the clipboard or the share
 * sheet for any other app. The log keeps the last app tried and, given up,
 * why.
 */
export function MailFallback({
  message,
  target,
  notificationId,
  onOpened,
  onSent,
  onAbandoned,
  onClose,
}: MailFallbackProps) {
  const outbox = useNotifications();
  const [failed, setFailed] = useState(target);
  const [status, setStatus] = useState<string>();
  const carried = useRef(false);
  const busy = useRef(false);
  const app = (name: MailTarget) => t(`mail.target.${name}`);
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const guard = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } catch {
      setStatus(t('mail.fallback.error'));
    } finally {
      busy.current = false;
    }
  };

  const retry = otherTargets(failed).map((other) => {
    const prepared = MAILERS[other].prepare(message);
    return {
      label: app(other),
      href: prepared.url,
      onClick: (event: MouseEvent) => {
        if (busy.current) {
          event.preventDefault();
          return;
        }
        const opening = MAILERS[other].open(prepared);
        void guard(async () => {
          if (notificationId) await outbox.retarget(notificationId, other);
          if ((await opening) === 'opened') {
            if (notificationId) await outbox.markOpened(notificationId);
            onOpened?.(other);
            return;
          }
          setFailed(other);
          setStatus(t('mail.fallback.stayed', { app: app(other) }));
        });
      },
    };
  });

  const copy = (text: string, done: string) =>
    void guard(async () => {
      const copied = await copyText(text);
      if (copied) carried.current = true;
      setStatus(copied ? done : t('mail.fallback.copyFailed'));
    });

  const share = () => {
    const sharing = shareMail(message);
    void guard(async () => {
      const outcome = await sharing;
      if (outcome === 'shared') carried.current = true;
      setStatus(
        outcome === 'shared'
          ? t('mail.fallback.shared')
          : outcome === 'cancelled'
            ? t('mail.fallback.shareCancelled')
            : outcome === 'blocked'
              ? t('mail.fallback.shareBlocked')
              : t('mail.fallback.shareUnavailable'),
      );
    });
  };

  const address = message.to.join(', ');

  return (
    <MailFallbackSheet
      description={notOpenedHint(failed, t)}
      retry={retry}
      onCopyText={() => copy(mailText(message), t('mail.fallback.copied'))}
      address={address || undefined}
      onCopyAddress={() => copy(address, t('mail.fallback.addressCopied'))}
      onShare={canShare ? share : undefined}
      status={status}
      onMarkSent={
        notificationId
          ? () =>
              void guard(async () => {
                if (carried.current) {
                  await outbox.retarget(notificationId, null);
                }
                onSent?.(await outbox.markSent(notificationId));
              })
          : undefined
      }
      onAbandon={
        notificationId
          ? () =>
              void guard(async () => {
                await outbox.markFailed(
                  notificationId,
                  notOpenedReason(failed, t),
                );
                onAbandoned?.();
              })
          : undefined
      }
      onClose={notificationId ? undefined : onClose}
      onDismiss={notificationId ? undefined : onClose}
    />
  );
}
