import type { ReactNode } from 'react';

import {
  Field,
  FieldAction,
  FieldInput,
  FieldPicker,
  type FieldPickerOption,
  FieldSelect,
} from '#components/field';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { Stepper } from '#components/stepper';

/** What the form edits, as typed: the app parses and checks it on save. */
export type ModifierColisValues = {
  tracking: string;
  carrier: string;
  sender: string;
  /** Boxes the label announces (N of "n/N"). */
  pieces: number;
  /** Boxes received so far (n), up to `pieces`. */
  piecesReceived: number;
  note: string;
  email: string;
  service: string;
  reference: string;
  /** In kilograms, as typed: "2,4". */
  weight: string;
  location: string;
};

export type ModifierColisErrors = Partial<
  Record<keyof ModifierColisValues | 'recipient', string>
>;

export type ModifierColisScreenProps = {
  /** "Camille Morel, Studio"; empty while nobody is chosen. */
  recipient: string;
  values: ModifierColisValues;
  onChange?: (values: ModifierColisValues) => void;
  /** Carriers to pick from; the current one is kept even when unlisted. */
  carriers?: readonly FieldPickerOption[];
  /** Result of the carrier's check digit, under the tracking number. */
  trackingCheck?: { tone: 'green' | 'orange' | 'red'; text: string };
  /** Why the sender is pre-filled, under its field. */
  senderHelp?: string;
  /** The fields the mockup leaves out (e-mail, service, weight…), below the note. */
  annex?: boolean;
  errors?: ModifierColisErrors;
  /** Red line under the bar: why saving failed. */
  failure?: ReactNode;
  saving?: boolean;
  onRecipientClick?: () => void;
  onRescan?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
};

/**
 * Correcting what the scan read. Each value sits in its own field with its
 * label above, so the agent checks them one by one against the label.
 */
export function ModifierColisScreen({
  recipient,
  values,
  onChange,
  carriers = [],
  trackingCheck,
  senderHelp,
  annex = true,
  errors = {},
  failure,
  saving = false,
  onRecipientClick,
  onRescan,
  onCancel,
  onSave,
}: ModifierColisScreenProps) {
  const set = <Key extends keyof ModifierColisValues>(
    key: Key,
    value: ModifierColisValues[Key],
  ) => onChange?.({ ...values, [key]: value });
  const carrierOptions =
    values.carrier && !carriers.some((c) => c.value === values.carrier)
      ? [{ value: values.carrier, label: values.carrier }, ...carriers]
      : carriers;
  const text = (key: keyof ModifierColisValues) => ({
    value: values[key] as string,
    onChange: (event: { target: { value: string } }) =>
      set(key, event.target.value),
  });
  const help = (key: keyof ModifierColisErrors, fallback?: string) =>
    errors[key] ?? fallback;
  const tone = (key: keyof ModifierColisErrors) =>
    errors[key] ? ('red' as const) : ('muted' as const);

  return (
    <Screen>
      <NavBar
        leading={
          <NavBarAction tone="blue" className="font-normal" onClick={onCancel}>
            Annuler
          </NavBarAction>
        }
        title="Modifier le colis"
        trailing={
          <NavBarAction
            tone="blue"
            disabled={saving}
            onClick={onSave}
            className="disabled:opacity-40"
          >
            Enregistrer
          </NavBarAction>
        }
      />
      {failure && <p className="mt-2 text-13 text-red">{failure}</p>}
      <Field
        label="Destinataire"
        help={errors.recipient}
        helpTone="red"
        className="mt-3"
      >
        {(id) => (
          <FieldSelect
            id={id}
            value={recipient}
            placeholder="Choisir dans l’annuaire"
            onClick={onRecipientClick}
          />
        )}
      </Field>
      <Field
        label="Numéro de suivi"
        help={help('tracking', trackingCheck?.text)}
        helpTone={errors.tracking ? 'red' : trackingCheck?.tone}
        className="mt-4"
      >
        {(id) => (
          <FieldInput
            id={id}
            mono
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            {...text('tracking')}
            trailing={
              onRescan && (
                <FieldAction
                  icon="scan"
                  label="Scanner à nouveau"
                  onClick={onRescan}
                />
              )
            }
          />
        )}
      </Field>
      <Field
        label="Transporteur"
        help={errors.carrier}
        helpTone="red"
        className="mt-[18px]"
      >
        {(id) => (
          <FieldPicker
            id={id}
            value={values.carrier}
            options={carrierOptions}
            placeholder="Choisir"
            onValueChange={(carrier) => set('carrier', carrier)}
          />
        )}
      </Field>
      <Field
        label="Expéditeur"
        help={help('sender', senderHelp)}
        helpTone={tone('sender')}
        className="mt-4"
      >
        {(id) => <FieldInput id={id} {...text('sender')} />}
      </Field>
      <div className="mt-[18px] flex items-center justify-between gap-4">
        <span className="text-17">Nombre de colis</span>
        <Stepper
          label="Nombre de colis"
          value={values.pieces}
          onValueChange={(pieces) =>
            onChange?.({
              ...values,
              pieces,
              piecesReceived: Math.min(values.piecesReceived, pieces),
            })
          }
          className="w-[106px]"
        />
      </div>
      {annex && values.pieces > 1 && (
        <div className="mt-3 flex items-center justify-between gap-4">
          <span className="text-17">Colis reçus</span>
          <Stepper
            label="Colis reçus"
            value={values.piecesReceived}
            max={values.pieces}
            onValueChange={(received) => set('piecesReceived', received)}
            className="w-[106px]"
          />
        </div>
      )}
      <Field label="Note" className="mt-5">
        {(id) => (
          <FieldInput
            id={id}
            placeholder="Ajouter une note"
            {...text('note')}
          />
        )}
      </Field>
      {annex && (
        <>
          <Field
            label="E-mail de notification"
            help={help('email')}
            helpTone="red"
            className="mt-4"
          >
            {(id) => (
              <FieldInput
                id={id}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Celui de l’annuaire"
                {...text('email')}
              />
            )}
          </Field>
          <Field label="Service" className="mt-4">
            {(id) => (
              <FieldInput
                id={id}
                placeholder="Express, Standard…"
                {...text('service')}
              />
            )}
          </Field>
          <Field label="Référence" className="mt-4">
            {(id) => (
              <FieldInput
                id={id}
                placeholder="Commande, facture…"
                autoComplete="off"
                {...text('reference')}
              />
            )}
          </Field>
          <Field
            label="Poids"
            help={help('weight')}
            helpTone="red"
            className="mt-4"
          >
            {(id) => (
              <FieldInput
                id={id}
                inputMode="decimal"
                placeholder="0,0"
                autoComplete="off"
                {...text('weight')}
                trailing={<span className="text-17 text-muted">kg</span>}
              />
            )}
          </Field>
          <Field label="Emplacement" className="mt-4">
            {(id) => (
              <FieldInput
                id={id}
                placeholder="Étagère B"
                {...text('location')}
              />
            )}
          </Field>
        </>
      )}
    </Screen>
  );
}
