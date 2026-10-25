import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  type ContactDraft,
  type ContactDraftErrors,
  NewContactSheet,
} from '@repo/ui';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import type { LocalDirectoryPerson } from '#/features/db/schema';
import {
  findByEmail,
  savePerson,
  toDraft,
  toEntry,
} from '#/features/directory/people';

const t = createTranslator(DEFAULT_LOCALE);

const EMPTY: ContactDraft = {
  firstName: '',
  lastName: '',
  email: '',
  department: '',
};

export type PersonSheetProps = {
  /** The card to edit; a new person otherwise. */
  person?: LocalDirectoryPerson;
  /** Prefills a new card, e.g. the name read on a label. */
  initial?: Partial<ContactDraft>;
  /** The person saved, or the one already there that the agent chose. */
  onDone: (person: LocalDirectoryPerson) => void;
  /** "Utiliser cette fiche"; `onDone` when not given. */
  onUseExisting?: (person: LocalDirectoryPerson) => void;
  onDismiss: () => void;
};

/**
 * Adds a person to the directory, or edits one, over whatever screen asked:
 * Réglages › Annuaire today, the handover screen next (YSL-71 to 78). The
 * duplicate shows as soon as the typed e-mail is someone's.
 */
export function PersonSheet({
  person,
  initial,
  onDone,
  onUseExisting = onDone,
  onDismiss,
}: PersonSheetProps) {
  const [draft, setDraft] = useState<ContactDraft>(() =>
    person ? toDraft(person) : { ...EMPTY, ...initial },
  );
  const [errors, setErrors] = useState<ContactDraftErrors>({});
  const [duplicate, setDuplicate] = useState<LocalDirectoryPerson | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    void findByEmail(db, draft.email, person?.id).then((found) => {
      if (current) setDuplicate(found ?? null);
    });
    return () => {
      current = false;
    };
  }, [draft.email, person?.id]);

  const onChange = (next: ContactDraft) => {
    setDraft(next);
    setErrors({});
    setFailed(false);
  };

  const onSubmit = async () => {
    setSaving(true);
    try {
      const result = await savePerson(db, draft, { id: person?.id });
      if (result.kind === 'saved') onDone(result.person);
      else if (result.kind === 'duplicate') setDuplicate(result.person);
      else setErrors(result.errors);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <NewContactSheet
      fixed
      {...(person && {
        title: t('directory.edit.title'),
        description: t('directory.edit.description'),
        submitLabel: t('directory.edit.submit'),
      })}
      {...(failed && { description: t('directory.error.save') })}
      value={draft}
      onChange={onChange}
      errors={errors}
      duplicate={duplicate && toEntry(duplicate)}
      onUseDuplicate={duplicate ? () => onUseExisting(duplicate) : undefined}
      saving={saving}
      onSubmit={() => void onSubmit()}
      onDismiss={onDismiss}
    />
  );
}
