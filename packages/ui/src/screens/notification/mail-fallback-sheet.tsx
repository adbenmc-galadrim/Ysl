import type { MouseEventHandler, ReactNode } from 'react';

import { Button, buttonVariants } from '#components/button';
import { Sheet } from '#components/sheet';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type MailFallbackLink = {
  /** The app's name: "Outlook". */
  label: string;
  /** The same mail, by the link of that app: a real `<a href>`, for iOS. */
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export type MailFallbackSheetProps = {
  /** Why it may not have opened: the app missing, offloaded or never opened (S5). */
  description: ReactNode;
  /** The two other mail apps. */
  retry: MailFallbackLink[];
  onCopyText?: () => void;
  /** The recipient's address, copied on its own to paste in the "To" field. */
  address?: string;
  onCopyAddress?: () => void;
  /** Omitted where the browser has no share sheet. */
  onShare?: () => void;
  /** What just happened: "Texte copié", read out by VoiceOver. */
  status?: string;
  /** With a mail on record: the agent sent it some other way. */
  onMarkSent?: () => void;
  /** With a mail on record: give it up, the reason goes in the log. */
  onAbandon?: () => void;
  /** Without a mail on record (a test): just close. */
  onClose?: () => void;
  onDismiss?: () => void;
};

/**
 * Shown when the page stayed in front after "Envoyer": the mail app did
 * not take over (S5). The agent tries another app, carries the text to any
 * app by copy or share, or says how it ended.
 */
export function MailFallbackSheet({
  description,
  retry,
  onCopyText,
  address,
  onCopyAddress,
  onShare,
  status,
  onMarkSent,
  onAbandon,
  onClose,
  onDismiss,
}: MailFallbackSheetProps) {
  return (
    <Sheet
      fixed
      title="La messagerie ne s’est pas ouverte"
      description={description}
      className="pb-[calc(var(--safe-bottom)+16px)]"
      onDismiss={onDismiss}
    >
      {retry.length > 0 && (
        <p className="mt-6 text-13 font-semibold text-muted">Réessayer avec</p>
      )}
      {retry.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          {retry.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={link.onClick}
              aria-label={`Réessayer avec ${link.label}`}
              className={buttonVariants({
                variant: 'secondary',
                size: 'md',
                block: true,
              })}
            >
              <Icon name="mail" size={18} />
              {link.label}
            </a>
          ))}
        </div>
      )}
      <div
        className={cn(
          'grid grid-cols-2 gap-3',
          retry.length > 0 ? 'mt-3' : 'mt-6',
        )}
      >
        {onCopyText && (
          <Button variant="secondary" size="md" block onClick={onCopyText}>
            Copier le texte
          </Button>
        )}
        {address && onCopyAddress && (
          <Button
            variant="secondary"
            size="md"
            block
            aria-label={`Copier l’adresse ${address}`}
            onClick={onCopyAddress}
          >
            Copier l’adresse
          </Button>
        )}
      </div>
      {onShare && (
        <Button
          variant="secondary"
          size="md"
          icon="share"
          block
          className="mt-3"
          onClick={onShare}
        >
          Partager…
        </Button>
      )}
      <p
        role="status"
        className="mt-3 min-h-[18px] text-center text-13 text-muted"
      >
        {status}
      </p>
      {onMarkSent && (
        <Button block className="mt-3" onClick={onMarkSent}>
          Marquer comme envoyé quand même
        </Button>
      )}
      {onAbandon && (
        <Button variant="danger" block className="mt-3" onClick={onAbandon}>
          Abandonner
        </Button>
      )}
      {onClose && (
        <Button variant="secondary" block className="mt-3" onClick={onClose}>
          Fermer
        </Button>
      )}
    </Sheet>
  );
}
