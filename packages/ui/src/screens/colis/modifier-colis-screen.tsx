import { useState } from 'react';

import {
  Field,
  FieldAction,
  FieldInput,
  FieldSelect,
} from '#components/field';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { Stepper } from '#components/stepper';

export type ModifierColisScreenProps = {
  recipient: string;
  tracking: string;
  /** Result of the carrier's check digit, under the tracking number. */
  trackingCheck?: { ok: boolean; text: string };
  carrier: string;
  sender: string;
  /** Why the sender is pre-filled, under its field. */
  senderHelp?: string;
  pieces: number;
  note?: string;
};

/**
 * Correcting what the scan read. Each value sits in its own field with its
 * label above, so the agent checks them one by one against the label.
 */
export function ModifierColisScreen({
  recipient,
  tracking,
  trackingCheck,
  carrier,
  sender,
  senderHelp,
  pieces: initialPieces,
  note,
}: ModifierColisScreenProps) {
  const [pieces, setPieces] = useState(initialPieces);
  return (
    <Screen>
      <NavBar
        leading={
          <NavBarAction tone="blue" className="font-normal">
            Annuler
          </NavBarAction>
        }
        title="Modifier le colis"
        trailing={<NavBarAction tone="blue">Enregistrer</NavBarAction>}
      />
      <Field label="Destinataire" className="mt-3">
        {(id) => <FieldSelect id={id} value={recipient} />}
      </Field>
      <Field
        label="Numéro de suivi"
        help={trackingCheck?.text}
        helpTone={trackingCheck?.ok ? 'green' : 'red'}
        className="mt-4"
      >
        {(id) => (
          <FieldInput
            id={id}
            mono
            defaultValue={tracking}
            trailing={<FieldAction icon="scan" label="Scanner à nouveau" />}
          />
        )}
      </Field>
      <Field label="Transporteur" className="mt-[18px]">
        {(id) => <FieldSelect id={id} value={carrier} />}
      </Field>
      <Field label="Expéditeur" help={senderHelp} className="mt-4">
        {(id) => <FieldInput id={id} defaultValue={sender} />}
      </Field>
      <div className="mt-[18px] flex items-center justify-between gap-4">
        <span className="text-17">Nombre de colis</span>
        <Stepper
          label="Nombre de colis"
          value={pieces}
          onValueChange={setPieces}
          className="w-[106px]"
        />
      </div>
      <Field label="Note" className="mt-5">
        {(id) => (
          <FieldInput
            id={id}
            defaultValue={note}
            placeholder="Ajouter une note"
          />
        )}
      </Field>
    </Screen>
  );
}
