import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { PersonFormErrors, PersonFormValue } from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
import { db } from '#/features/db/database';
import type { LocalDirectoryPerson } from '#/features/db/schema';
import {
  departmentLabel,
  type DepartmentNames,
  findByEmail,
  keepsAddress,
  savePerson,
  toDraft,
} from '#/features/directory/people';

const t = createTranslator(DEFAULT_LOCALE);

const EMPTY: PersonFormValue = {
  name: '',
  email: '',
  site: '',
  departmentId: '',
};

/**
 * The state of the add and edit forms, whichever draws them. The duplicate
 * shows as soon as the typed e-mail is someone's; that person's record is one
 * touch away, as an e-mail never makes a second card.
 */
export function usePersonForm({
  person,
  initial,
  names,
  onDone,
}: {
  person?: LocalDirectoryPerson;
  initial?: Partial<PersonFormValue>;
  names: DepartmentNames;
  onDone: (person: LocalDirectoryPerson) => void;
}) {
  const [value, setValue] = useState<PersonFormValue>(() =>
    person ? toDraft(person) : { ...EMPTY, ...initial },
  );
  const [errors, setErrors] = useState<PersonFormErrors>({});
  const [duplicate, setDuplicate] = useState<LocalDirectoryPerson | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const submitting = useRef(false);

  useEffect(() => {
    let current = true;
    const check = keepsAddress(person, value.email)
      ? Promise.resolve(undefined)
      : findByEmail(db, value.email, person?.id);
    void check.then((found) => {
      if (current) setDuplicate(found ?? null);
    });
    return () => {
      current = false;
    };
  }, [value.email, person]);

  const onChange = (next: PersonFormValue) => {
    setValue(next);
    setErrors({});
    setMessage(undefined);
  };

  const onSubmit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      const result = await savePerson(db, value, { id: person?.id });
      if (result.kind === 'saved') onDone(result.person);
      else if (result.kind === 'duplicate') setDuplicate(result.person);
      else setErrors(result.errors);
    } catch {
      setMessage(t('directory.error.save'));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const where = duplicate && departmentLabel(duplicate, names);
  return {
    value,
    onChange,
    errors,
    duplicate,
    conflictTitle: where
      ? t('directory.duplicate.in', { department: where })
      : t('directory.duplicate.title'),
    saving,
    message,
    onSubmit: () => void onSubmit(),
  };
}
