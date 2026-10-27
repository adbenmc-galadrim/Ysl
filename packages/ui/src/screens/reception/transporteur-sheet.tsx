import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '#components/button';
import { Field, FieldInput } from '#components/field';
import { FilterChip } from '#components/filter-chip';
import { Sheet } from '#components/sheet';

export type TransporteurSheetProps = {
  /** The number the carrier is chosen for, as printed. */
  tracking?: string;
  /** The carriers the app knows, as they read: « Colissimo », « UPS »… */
  carriers: readonly string[];
  /** The carrier chosen so far, one of the list or typed under « Autre ». */
  value?: string;
  onPick: (carrier: string) => void;
  onDismiss?: () => void;
  fixed?: boolean;
  behind?: ReactNode;
};

/**
 * Which carrier brought the parcel, when the number's format does not say
 * (§4.4): one tap on a known one, or « Autre » and its name typed. Chips
 * rather than a list, so the twenty carriers fit in one look.
 */
export function TransporteurSheet({
  tracking,
  carriers,
  value,
  onPick,
  onDismiss,
  fixed = false,
  behind,
}: TransporteurSheetProps) {
  const known = value === undefined || carriers.includes(value);
  const [other, setOther] = useState(known ? null : (value ?? ''));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (other?.trim()) onPick(other.trim());
  };

  return (
    <Sheet
      title="Transporteur"
      description={
        tracking
          ? `Le numéro ${tracking} ne nomme aucun transporteur.`
          : 'Le numéro ne nomme aucun transporteur.'
      }
      fixed={fixed}
      behind={behind}
      onDismiss={onDismiss}
    >
      <div
        role="radiogroup"
        aria-label="Transporteur"
        className="mt-5 flex flex-wrap gap-2"
      >
        {carriers.map((carrier) => (
          <FilterChip
            key={carrier}
            role="radio"
            aria-checked={other === null && carrier === value}
            label={carrier}
            selected={other === null && carrier === value}
            onClick={() => onPick(carrier)}
          />
        ))}
        <FilterChip
          role="radio"
          aria-checked={other !== null}
          label="Autre"
          selected={other !== null}
          onClick={() => setOther((typed) => typed ?? '')}
        />
      </div>
      {other !== null && (
        <form noValidate onSubmit={submit} className="mt-5 flex flex-col">
          <Field label="Nom du transporteur">
            {(id) => (
              <FieldInput
                id={id}
                value={other}
                onChange={(event) => setOther(event.target.value)}
                autoComplete="off"
                autoCapitalize="words"
              />
            )}
          </Field>
          <Button type="submit" block className="mt-6" disabled={!other.trim()}>
            Utiliser ce transporteur
          </Button>
        </form>
      )}
    </Sheet>
  );
}
