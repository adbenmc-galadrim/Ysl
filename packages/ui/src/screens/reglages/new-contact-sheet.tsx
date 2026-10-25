import type { FormEvent, ReactNode } from 'react';

import { Button } from '#components/button';
import { ContactRow } from '#components/contact-row';
import { Field, FieldInput } from '#components/field';
import { Sheet } from '#components/sheet';

export type ContactDraft = {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
};

export type ContactDraftErrors = Partial<Record<keyof ContactDraft, string>>;

/** The person the directory already has under the typed e-mail. */
export type ContactDuplicate = {
  name: string;
  initials: string;
  detail?: string;
};

export type NewContactSheetProps = {
  /** "Nouvelle personne", or "Modifier la fiche" when editing. */
  title?: string;
  description?: ReactNode;
  value: ContactDraft;
  onChange: (value: ContactDraft) => void;
  errors?: ContactDraftErrors;
  /** Shown instead of saving a second card for the same e-mail. */
  duplicate?: ContactDuplicate | null;
  /** "Utiliser cette fiche": takes the person already there. */
  onUseDuplicate?: () => void;
  submitLabel?: string;
  saving?: boolean;
  onSubmit: () => void;
  onDismiss?: () => void;
  /** Over the app's screen (`Sheet` `fixed`), or over `behind` in a story. */
  fixed?: boolean;
  behind?: ReactNode;
};

/**
 * Adds someone to the directory where the question comes up: from the
 * directory itself, or at the desk while handing a parcel over (D15). The
 * e-mail is the key — the same address never makes a second card, the
 * sheet offers the one already there instead.
 */
export function NewContactSheet({
  title = 'Nouvelle personne',
  description = 'Elle sera proposée sur tous les iPhone du service.',
  value,
  onChange,
  errors = {},
  duplicate,
  onUseDuplicate,
  submitLabel = 'Ajouter à l’annuaire',
  saving = false,
  onSubmit,
  onDismiss,
  fixed = false,
  behind,
}: NewContactSheetProps) {
  const set =
    (key: keyof ContactDraft) => (event: { target: { value: string } }) =>
      onChange({ ...value, [key]: event.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!saving) onSubmit();
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" help={errors.firstName} helpTone="red">
            {(id) => (
              <FieldInput
                id={id}
                value={value.firstName}
                onChange={set('firstName')}
                autoComplete="off"
                autoCapitalize="words"
                aria-invalid={errors.firstName ? true : undefined}
              />
            )}
          </Field>
          <Field label="Nom" help={errors.lastName} helpTone="red">
            {(id) => (
              <FieldInput
                id={id}
                value={value.lastName}
                onChange={set('lastName')}
                autoComplete="off"
                autoCapitalize="words"
                aria-invalid={errors.lastName ? true : undefined}
              />
            )}
          </Field>
        </div>
        <Field
          label="E-mail"
          help={errors.email ?? 'Sert à prévenir la personne de ses colis.'}
          helpTone={errors.email ? 'red' : 'muted'}
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
              aria-invalid={errors.email || duplicate ? true : undefined}
            />
          )}
        </Field>
        {duplicate && (
          <div
            role="status"
            className="mt-3 flex flex-col gap-3 rounded-control border border-border p-3"
          >
            <p className="text-13 font-medium text-orange">
              Cette adresse est déjà dans l’annuaire
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
          disabled={saving || Boolean(duplicate)}
        >
          {submitLabel}
        </Button>
      </form>
    </Sheet>
  );
}
