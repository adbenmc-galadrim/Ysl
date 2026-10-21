import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import {
  EmailDraft,
  EmailRecipient,
  type EmailDraftProps,
  type EmailRecipientProps,
} from '#components/email-draft';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';

export type ApercuEmailScreenProps = {
  /** Rank of this e-mail in the batch, from 1. */
  position: number;
  total: number;
  recipient: EmailRecipientProps;
  draft: EmailDraftProps;
  onBack?: () => void;
  onNext?: () => void;
  onSendAll?: () => void;
};

/**
 * Proofreading the pickup e-mails of a batch before they go. "Suivant" pages
 * through them one by one, but sending stays one tap away at any point: the
 * preview is a check the agent may skip, not a step they must finish.
 */
export function ApercuEmailScreen({
  position,
  total,
  recipient,
  draft,
  onBack,
  onNext,
  onSendAll,
}: ApercuEmailScreenProps) {
  return (
    <Screen
      tone="fill"
      bottom={
        <BottomBar surface="fade-fill">
          <Button
            variant="secondary"
            className="w-[120px]"
            onClick={onNext}
            disabled={position >= total}
          >
            Suivant
          </Button>
          <Button className="min-w-0 flex-1" onClick={onSendAll}>
            Envoyer les {total} e-mails
          </Button>
        </BottomBar>
      }
    >
      <NavBar title={`Aperçu, ${position} sur ${total}`} onBack={onBack} />
      <EmailRecipient {...recipient} className="mt-3" />
      <EmailDraft {...draft} className="mt-3.5" />
    </Screen>
  );
}
