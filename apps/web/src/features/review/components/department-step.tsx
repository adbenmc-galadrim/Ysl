import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { type ScanField, VerifierDepartementScreen } from '@repo/ui';
import { useRef, useState } from 'react';
import { db } from '#/features/db/database';
import type {
  LocalDepartment,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import { chooseDepartment } from '#/features/review/actions';
import type { StepProps } from '#/features/review/components/step';

const t = createTranslator(DEFAULT_LOCALE);

type DepartmentStepProps = StepProps & {
  departments: readonly LocalDepartment[];
  people: readonly LocalDirectoryPerson[];
  /** Where it goes so far, for a ready parcel sent elsewhere. */
  selected?: string;
  onDone?: () => void;
};

/**
 * The department of a parcel (ME25): asked when its recipient has none, and
 * opened from a ready parcel to send it elsewhere. The choice is written on the
 * draft, and holds for this parcel only.
 */
export function DepartmentStep({
  draft,
  departments,
  people,
  selected,
  onDone,
  ...frame
}: DepartmentStepProps) {
  const [value, setValue] = useState(selected);
  const submitting = useRef(false);
  const open = departments.filter((department) => !department.deletedAt);
  const own =
    draft.recipient?.kind === 'person'
      ? people.find((person) => person.id === draft.recipient?.id)?.departmentId
      : null;
  const fields: ScanField[] = draft.recipient
    ? [{ label: t('scan.field.recipient'), value: draft.recipient.name }]
    : [];

  const onSubmit = async () => {
    if (!value || submitting.current) return;
    submitting.current = true;
    try {
      await chooseDepartment(db, draft.id, value);
      onDone?.();
    } finally {
      submitting.current = false;
    }
  };

  return (
    <VerifierDepartementScreen
      {...frame}
      recipientDepartment={open.find(({ id }) => id === own)?.name ?? null}
      departments={open.map(({ id, name }) => ({ id, name }))}
      selectedId={value}
      fields={fields}
      onSelect={setValue}
      onSubmit={() => void onSubmit()}
    />
  );
}
