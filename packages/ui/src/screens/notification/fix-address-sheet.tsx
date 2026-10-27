import type { MouseEvent, ReactNode } from 'react';

import { Button, buttonVariants } from '#components/button';
import { Checkbox } from '#components/checkbox';
import { Field, FieldInput } from '#components/field';
import { Sheet } from '#components/sheet';
import { Icon } from '#icons';

export type FixAddressSheetProps = {
  recipient: string;
  /** The address the server refused, quoted so the typo is visible. */
  rejected?: string;
  /** Why it was refused, after the colon. */
  reason?: string;
  title?: string;
  /** Replaces the refusal sentence: what happened to the last mail. */
  description?: string;
  value: string;
  /** Makes the field controlled: the screen checks each keystroke. */
  onValueChange?: (value: string) => void;
  valid?: boolean;
  /** Under the field, in red: why the address cannot be used. */
  error?: string;
  /** Also fix the card (directory or contact), so the next e-mail goes right. */
  updateDirectory?: boolean;
  onUpdateDirectoryChange?: (checked: boolean) => void;
  updateLabel?: string;
  /** The card cannot take the address: the box stays unticked, greyed. */
  updateDisabled?: boolean;
  /** Under the box: why it is greyed. */
  updateHelp?: string;
  resendLabel?: string;
  /**
   * The mail app's link: the button is then a real `<a href>`, the only
   * way iOS opens a mail app (from the tap itself, never from script).
   */
  resendHref?: string;
  onResend?: (event: MouseEvent) => void;
  onShowParcels?: () => void;
  onDismiss?: () => void;
  /** Over the viewport, as the app mounts its sheets. */
  fixed?: boolean;
  /** The screen the sheet was opened from, dimmed behind it. */
  behind?: ReactNode;
};

/**
 * Fixing the address of a mail that did not go, without leaving the
 * sending log. Updating the card is on by default: an address fixed only
 * once goes wrong again with the next parcel.
 */
export function FixAddressSheet({
  recipient,
  rejected,
  reason,
  title = 'Corriger l’adresse',
  description = `Le serveur a refusé ${rejected} : ${reason}`,
  value,
  onValueChange,
  valid = true,
  error,
  updateDirectory = true,
  onUpdateDirectoryChange,
  updateLabel = 'Mettre à jour la fiche dans l’annuaire',
  updateDisabled = false,
  updateHelp,
  resendLabel = 'Renvoyer l’e-mail',
  resendHref,
  onResend,
  onShowParcels,
  onDismiss,
  fixed,
  behind,
}: FixAddressSheetProps) {
  const ready = valid && !error;
  return (
    <Sheet
      fixed={fixed}
      behind={behind}
      title={title}
      description={description}
      descriptionClassName="leading-[1.4]"
      scrimClassName="bg-black/35"
      className="h-[522px] pb-[calc(var(--safe-bottom)+6px)]"
      onDismiss={onDismiss}
    >
      <Field
        label={`Adresse e-mail de ${recipient}`}
        help={error ?? (valid ? 'Format valide' : undefined)}
        helpTone={error ? 'red' : 'green'}
        className="mt-3.5"
      >
        {(id) => (
          <FieldInput
            id={id}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            variant="outline"
            {...(onValueChange
              ? {
                  value,
                  onChange: (event) => onValueChange(event.target.value),
                }
              : { defaultValue: value })}
            trailing={
              ready && (
                <Icon name="check" size={20} className="shrink-0 text-green" />
              )
            }
          />
        )}
      </Field>
      <div className="mt-5 flex h-[52px] items-center gap-2.5 rounded-control bg-fill px-3 text-15">
        <Checkbox
          checked={updateDirectory && !updateDisabled}
          disabled={updateDisabled}
          className="disabled:opacity-40"
          onCheckedChange={onUpdateDirectoryChange}
          label={updateLabel}
        />
        <span
          aria-hidden="true"
          className={updateDisabled ? 'text-muted' : undefined}
        >
          {updateLabel}
        </span>
      </div>
      {updateHelp && (
        <p className="mt-2 text-13 leading-[1.35] text-muted">{updateHelp}</p>
      )}
      {onShowParcels && (
        <Button
          variant="link"
          className="mt-4 self-start text-16"
          onClick={onShowParcels}
        >
          Voir les colis
        </Button>
      )}
      {resendHref && ready ? (
        <a
          href={resendHref}
          onClick={onResend}
          className={buttonVariants({ block: true, class: 'mt-auto' })}
        >
          {resendLabel}
        </a>
      ) : (
        <Button
          block
          className="mt-auto"
          disabled={!!resendHref && !ready}
          onClick={onResend}
        >
          {resendLabel}
        </Button>
      )}
    </Sheet>
  );
}
