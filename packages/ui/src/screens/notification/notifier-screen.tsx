import type { MouseEvent, ReactNode } from 'react';

import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button, buttonVariants } from '#components/button';
import {
  EmailRecipient,
  EmailText,
  type EmailRecipientProps,
} from '#components/email-draft';
import { GroupedRow, GroupedSection } from '#components/grouped-list';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { Sheet } from '#components/sheet';
import { Icon } from '#icons';
import type { TemplateWarning } from '#screens/reglages/email-template-screen';

/**
 * Where this recipient's mail stands in the session: still to send, sent as
 * the agent said, said not to have gone, or impossible without an address.
 */
export type NotifierMailState = 'ready' | 'sent' | 'failed' | 'missing';

export type NotifierScreenProps = {
  /** Rank of this recipient's mail, from 1. */
  position: number;
  total: number;
  recipient: EmailRecipientProps;
  state: NotifierMailState;
  /** The template the mails start from, and the way to pick another. */
  template: { name: string; onClick?: () => void };
  /** "Modifier le modèle": its page in Réglages. */
  onEditTemplate?: () => void;
  preview: { subject: string; body: string };
  /** What the agent should know before it leaves: a variable left blank. */
  warnings?: TemplateWarning[];
  /** "Envoyer à Nora": a real link, the only way iOS opens a mail app. */
  sendLabel: string;
  sendHref?: string;
  /** Called with the tap: `preventDefault` keeps a second tap from opening Mail again. */
  onSend?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /**
   * "Partager avec le QR": the share sheet with the pickup QR as an image,
   * the address typed in the mail app (S5). Offered while the mail is to send.
   */
  shareLabel?: string;
  shareHint?: string;
  onShare?: () => void;
  /** Where the address is typed when there is none. */
  completeLabel?: string;
  onComplete?: () => void;
  /** A word under the recipient once the agent answered: sent, not sent. */
  notice?: { title: string; description?: string };
  /** "Suivant", or "Terminer" on the last mail. */
  nextLabel: string;
  onNext?: () => void;
  onBack?: () => void;
  /** The question asked when the agent comes back from the mail app. */
  sheet?: ReactNode;
};

/**
 * One e-mail per recipient (F34), paged as in « Aperçu de l'e-mail ». The
 * mails cannot leave together: iOS opens the mail app once per tap on a
 * link (S5), so each page has its own "Envoyer", and the agent says on
 * coming back whether it left.
 */
export function NotifierScreen({
  position,
  total,
  recipient,
  state,
  template,
  onEditTemplate,
  preview,
  warnings = [],
  sendLabel,
  sendHref,
  onSend,
  shareLabel,
  shareHint,
  onShare,
  completeLabel,
  onComplete,
  notice,
  nextLabel,
  onNext,
  onBack,
  sheet,
}: NotifierScreenProps) {
  const primary =
    state === 'missing' ? (
      <Button className="min-w-0 flex-1" onClick={onComplete}>
        {completeLabel}
      </Button>
    ) : state === 'sent' || !sendHref ? (
      <Button className="min-w-0 flex-1" disabled>
        {sendLabel}
      </Button>
    ) : (
      <a
        href={sendHref}
        onClick={onSend}
        className={buttonVariants({ class: 'min-w-0 flex-1' })}
      >
        <span className="truncate">{sendLabel}</span>
      </a>
    );
  return (
    <>
      <Screen
        tone="fill"
        bottom={
          <BottomBar surface="fade-fill">
            <Button variant="secondary" className="w-[120px]" onClick={onNext}>
              {nextLabel}
            </Button>
            {primary}
          </BottomBar>
        }
      >
        <NavBar title={`Aperçu, ${position} sur ${total}`} onBack={onBack} />
        <EmailRecipient {...recipient} className="mt-3" />
        {notice && (
          <Banner
            tone={state === 'sent' ? 'green' : 'orange'}
            icon={state === 'sent' ? 'check' : 'alert'}
            title={notice.title}
            description={notice.description}
            className="mt-3.5"
          />
        )}
        <GroupedSection className="mt-3.5">
          <GroupedRow
            title="Modèle"
            value={template.name}
            accessory={template.onClick ? 'chevron' : undefined}
            onClick={template.onClick}
          />
        </GroupedSection>
        {warnings.map((warning) => (
          <Banner
            key={warning.title}
            tone="orange"
            icon="alert"
            title={warning.title}
            description={warning.description}
            className="mt-3.5"
          />
        ))}
        <EmailText {...preview} className="mt-3.5" />
        {onShare && (state === 'ready' || state === 'failed') && (
          <>
            <Button
              variant="secondary"
              block
              className="mt-3.5 gap-2"
              onClick={onShare}
            >
              <Icon name="qr" size={20} />
              {shareLabel}
            </Button>
            {shareHint && (
              <p className="mt-2 px-4 text-13 leading-[1.4] text-muted">
                {shareHint}
              </p>
            )}
          </>
        )}
        {onEditTemplate && (
          <Button
            variant="link"
            block
            className="mt-3 text-16"
            onClick={onEditTemplate}
          >
            Modifier le modèle
          </Button>
        )}
      </Screen>
      {sheet}
    </>
  );
}

export type MailSentSheetProps = {
  recipient: string;
  /** What a "yes" does, when it is not notifying the parcels: a reminder noted. */
  description?: string;
  onSent?: () => void;
  onNotSent?: () => void;
  onDismiss?: () => void;
  /** From the sending log: the parcels the mail was about. */
  onShowParcels?: () => void;
};

/**
 * Asked on coming back from the mail app: nothing tells the app a mail
 * left (S5), so the agent says it, and only a "yes" notifies the parcels.
 */
export function MailSentSheet({
  recipient,
  description,
  onSent,
  onNotSent,
  onDismiss,
  onShowParcels,
}: MailSentSheetProps) {
  return (
    <Sheet
      fixed
      title="L’e-mail est-il parti ?"
      description={
        description ??
        `Si le message à ${recipient} est dans vos envoyés, ses colis passent « Notifié ».`
      }
      className="pb-[calc(var(--safe-bottom)+16px)]"
      onDismiss={onDismiss}
    >
      <Button block className="mt-6" onClick={onSent}>
        Oui, il est parti
      </Button>
      <Button variant="secondary" block className="mt-3" onClick={onNotSent}>
        Non, pas envoyé
      </Button>
      {onShowParcels && (
        <Button
          variant="link"
          block
          className="mt-3 text-16"
          onClick={onShowParcels}
        >
          Voir les colis
        </Button>
      )}
    </Sheet>
  );
}
