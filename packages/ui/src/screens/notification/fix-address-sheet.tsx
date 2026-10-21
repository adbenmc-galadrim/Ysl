import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { Checkbox } from '#components/checkbox';
import { Field, FieldInput } from '#components/field';
import { Sheet } from '#components/sheet';
import { Icon } from '#icons';

export type FixAddressSheetProps = {
  recipient: string;
  /** The address the server refused, quoted so the typo is visible. */
  rejected: string;
  /** Why it was refused, after the colon. */
  reason: string;
  value: string;
  valid?: boolean;
  /** Also fix the directory record, so the next e-mail does not bounce. */
  updateDirectory?: boolean;
  onUpdateDirectoryChange?: (checked: boolean) => void;
  onResend?: () => void;
  /** The screen the sheet was opened from, dimmed behind it. */
  behind?: ReactNode;
};

/**
 * Fixing a bounced address without leaving the sending log. Updating the
 * directory is on by default: a wrong address fixed only once bounces again
 * with the next parcel.
 */
export function FixAddressSheet({
  recipient,
  rejected,
  reason,
  value,
  valid = true,
  updateDirectory = true,
  onUpdateDirectoryChange,
  onResend,
  behind,
}: FixAddressSheetProps) {
  return (
    <Sheet
      behind={behind}
      title="Corriger l’adresse"
      description={`Le serveur a refusé ${rejected} : ${reason}`}
      descriptionClassName="leading-[1.4]"
      scrimClassName="bg-black/35"
      className="h-[522px] pb-[calc(var(--safe-bottom)+6px)]"
    >
      <Field
        label={`Adresse e-mail de ${recipient}`}
        help={valid ? 'Format valide' : undefined}
        helpTone="green"
        className="mt-3.5"
      >
        {(id) => (
          <FieldInput
            id={id}
            type="email"
            variant="outline"
            defaultValue={value}
            trailing={
              valid && (
                <Icon name="check" size={20} className="shrink-0 text-green" />
              )
            }
          />
        )}
      </Field>
      <div className="mt-5 flex h-[52px] items-center gap-2.5 rounded-control bg-fill px-3 text-15">
        <Checkbox
          checked={updateDirectory}
          onCheckedChange={onUpdateDirectoryChange}
          label="Mettre à jour la fiche dans l’annuaire"
        />
        <span aria-hidden="true">Mettre à jour la fiche dans l’annuaire</span>
      </div>
      <Button block className="mt-auto" onClick={onResend}>
        Renvoyer l’e-mail
      </Button>
    </Sheet>
  );
}
