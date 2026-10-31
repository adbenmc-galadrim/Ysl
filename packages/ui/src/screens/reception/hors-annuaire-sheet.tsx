import type { FormEvent, ReactNode } from 'react';

import { Button } from '#components/button';
import { ContactRow } from '#components/contact-row';
import { Field, FieldInput } from '#components/field';
import { Sheet } from '#components/sheet';

/** The person the directory already has under the typed e-mail. */
export type ContactDuplicate = {
  name: string;
  initials: string;
  detail?: string;
};

export type OutsideContactDraft = {
  name: string;
  email: string;
  department: string;
};

/** A directory card the contact may be merged into: same e-mail, or same name. */
export type HorsAnnuaireMerge = ContactDuplicate & {
  /** « Rattacher à Marc Petit ». */
  label: string;
  onMerge: () => void;
};

export type HorsAnnuaireSheetProps = {
  /** « Modifier le contact » when an existing one is edited. */
  title?: string;
  description?: string;
  submitLabel?: string;
  value: OutsideContactDraft;
  onChange: (value: OutsideContactDraft) => void;
  /** Under the e-mail, in red: « Adresse e-mail invalide ». */
  emailError?: string;
  /** Someone this mailroom already knows under the typed e-mail. */
  duplicate?: ContactDuplicate | null;
  /** « Utiliser cette fiche »: takes the one already there. */
  onUseDuplicate?: () => void;
  /** Offered without blocking the save: the directory now lists this person. */
  merge?: HorsAnnuaireMerge | null;
  /** Opens the sheet on the e-mail, e.g. from « Sans e-mail ». */
  focusEmail?: boolean;
  /** « Supprimer le contact », under the save. */
  onDelete?: () => void;
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
  title = 'Personne hors annuaire',
  description = 'Gardée comme contact, elle sera proposée ensuite.',
  submitLabel = 'Utiliser ce nom',
  value,
  onChange,
  emailError,
  duplicate,
  onUseDuplicate,
  merge,
  focusEmail = false,
  onDelete,
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
      title={title}
      description={description}
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
              autoFocus={focusEmail}
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
        {merge && (
          <div
            role="status"
            className="mt-4 flex flex-col gap-3 rounded-control border border-border p-3"
          >
            <p className="text-13 font-medium text-muted">
              Cette personne est maintenant dans l’annuaire
            </p>
            <ContactRow
              name={merge.name}
              initials={merge.initials}
              detail={merge.detail}
              trailing={null}
            />
            <Button
              variant="outline"
              size="md"
              block
              disabled={saving}
              onClick={merge.onMerge}
            >
              {merge.label}
            </Button>
          </div>
        )}
        <Button
          type="submit"
          block
          className="mt-6"
          disabled={saving || !value.name.trim() || Boolean(duplicate)}
        >
          {submitLabel}
        </Button>
        {onDelete && (
          <Button
            variant="danger"
            block
            className="mt-3"
            disabled={saving}
            onClick={onDelete}
          >
            Supprimer le contact
          </Button>
        )}
      </form>
    </Sheet>
  );
}
