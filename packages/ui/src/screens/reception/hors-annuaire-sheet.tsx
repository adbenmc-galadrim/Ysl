import type { FormEvent, ReactNode } from 'react';

import { Button } from '#components/button';
import { ContactRow } from '#components/contact-row';
import { Field, FieldInput } from '#components/field';
import { Sheet } from '#components/sheet';
import type { ContactDuplicate } from '#screens/reglages/new-contact-sheet';

export type OutsideContactDraft = {
  name: string;
  email: string;
  department: string;
};

export type HorsAnnuaireSheetProps = {
  value: OutsideContactDraft;
  onChange: (value: OutsideContactDraft) => void;
  /** Under the e-mail, in red: « Adresse e-mail invalide ». */
  emailError?: string;
  /** Someone this mailroom already knows under the typed e-mail. */
  duplicate?: ContactDuplicate | null;
  /** « Utiliser cette fiche »: takes the one already there. */
  onUseDuplicate?: () => void;
  saving?: boolean;
  onSubmit: () => void;
  onDismiss?: () => void;
  fixed?: boolean;
  behind?: ReactNode;
};

/**
 * « Personne hors annuaire » (F27): a temp, a visitor, someone the directory
 * does not list. A name is enough; the e-mail, when known, lets the mailroom
 * tell them, and is the key: the same address never makes a second contact.
 */
export function HorsAnnuaireSheet({
  value,
  onChange,
  emailError,
  duplicate,
  onUseDuplicate,
  saving = false,
  onSubmit,
  onDismiss,
  fixed = false,
  behind,
}: HorsAnnuaireSheetProps) {
  const set =
    (key: keyof OutsideContactDraft) =>
    (event: { target: { value: string } }) =>
      onChange({ ...value, [key]: event.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!saving && value.name.trim() && !duplicate) onSubmit();
  };

  return (
    <Sheet
      title="Personne hors annuaire"
      description="Gardée comme contact, elle sera proposée ensuite."
      fixed={fixed}
      behind={behind}
      onDismiss={onDismiss}
    >
      <form noValidate onSubmit={submit} className="mt-4 flex flex-col">
        <Field label="Nom">
          {(id) => (
            <FieldInput
              id={id}
              value={value.name}
              onChange={set('name')}
              autoComplete="off"
              autoCapitalize="words"
            />
          )}
        </Field>
        <Field
          label="E-mail (facultatif)"
          help={emailError ?? 'Sert à la prévenir de ses colis.'}
          helpTone={emailError ? 'red' : 'muted'}
          className="mt-4"
        >
          {(id) => (
            <FieldInput
              id={id}
              type="email"
              inputMode="email"
              value={value.email}
              onChange={set('email')}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={emailError || duplicate ? true : undefined}
            />
          )}
        </Field>
        {duplicate && (
          <div
            role="status"
            className="mt-3 flex flex-col gap-3 rounded-control border border-border p-3"
          >
            <p className="text-13 font-medium text-orange">
              Cette adresse est déjà connue
            </p>
            <ContactRow
              name={duplicate.name}
              initials={duplicate.initials}
              detail={duplicate.detail}
              trailing={null}
            />
            {onUseDuplicate && (
              <Button
                variant="outline"
                size="md"
                block
                onClick={onUseDuplicate}
              >
                Utiliser cette fiche
              </Button>
            )}
          </div>
        )}
        <Field label="Service (facultatif)" className="mt-4">
          {(id) => (
            <FieldInput
              id={id}
              value={value.department}
              onChange={set('department')}
              autoComplete="off"
              autoCapitalize="sentences"
            />
          )}
        </Field>
        <Button
          type="submit"
          block
          className="mt-6"
          disabled={saving || !value.name.trim() || Boolean(duplicate)}
        >
          Utiliser ce nom
        </Button>
      </form>
    </Sheet>
  );
}
