import { useId, type ReactNode } from 'react';

import { Button } from '#components/button';
import { Sheet } from '#components/sheet';
import { Toast } from '#components/toast';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

/**
 * « Signaler ce scan », test phase only (D32): the user sends the label's
 * whole photo and every reading so the reader can be improved. Everything
 * here goes with the feature before the first real users (YSL-148).
 */
export function SignalerScanButton({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mx-auto flex h-[30px] cursor-pointer items-center gap-1.5 rounded-chip bg-night-2 px-3 pb-px text-13 font-semibold text-white outline-none',
        'focus-visible:ring-2 focus-visible:ring-ios-blue active:brightness-125',
        className,
      )}
    >
      <Icon name="send" size={14} />
      Signaler ce scan
    </button>
  );
}

/** What leaves from the scan screen: the frame itself. */
const FRAME_SENT =
  'La photo complète de l’étiquette et tout ce que l’app a lu partent avec le rapport, pour améliorer la lecture. Phase de test.';

export type SignalerScanSheetProps = {
  comment: string;
  /** What leaves with the report, said before it does. */
  description?: string;
  onCommentChange: (comment: string) => void;
  /** The server's limit on the comment. */
  maxLength?: number;
  onSubmit?: () => void;
  onDismiss?: () => void;
  /** Over the app's own screen rather than around `behind`, see `Sheet`. */
  fixed?: boolean;
  behind?: ReactNode;
};

/**
 * What the report carries, said before it leaves, and an optional word on
 * what went wrong. Sending never waits: the sheet closes and the report
 * queues, so the next label can be shot at once.
 */
export function SignalerScanSheet({
  comment,
  description = FRAME_SENT,
  onCommentChange,
  maxLength = 2000,
  onSubmit,
  onDismiss,
  fixed,
  behind,
}: SignalerScanSheetProps) {
  const id = useId();
  return (
    <Sheet
      title="Signaler ce scan"
      description={description}
      scrimClassName="bg-black/35"
      fixed={fixed}
      behind={behind}
      onDismiss={onDismiss}
    >
      <label htmlFor={id} className="mt-5 text-13 font-medium text-muted">
        Commentaire (facultatif)
      </label>
      <textarea
        id={id}
        value={comment}
        maxLength={maxLength}
        rows={3}
        placeholder="Numéro faux, destinataire manquant…"
        onChange={(event) => onCommentChange(event.target.value)}
        className="mt-1.5 min-h-[96px] w-full resize-none rounded-control bg-fill px-4 py-3 text-17 text-ink caret-blue outline-none placeholder:text-muted focus:ring-2 focus:ring-blue focus:ring-inset"
      />
      <Button block className="mt-4" onClick={onSubmit}>
        Envoyer le rapport
      </Button>
    </Sheet>
  );
}

/** The word after « Envoyer »: queued, sent, or why it did not leave. */
export function SignalerScanToast({
  message,
  className,
}: {
  message: ReactNode;
  className?: string;
}) {
  return <Toast message={message} className={className} />;
}
