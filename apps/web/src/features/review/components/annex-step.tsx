import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { type ScanField, VerifierChampScreen } from '@repo/ui';
import { useRef, useState } from 'react';
import { db } from '#/features/db/database';
import { annexText, settleAnnex } from '#/features/review/actions';
import type { StepProps } from '#/features/review/components/step';
import type { AnnexField } from '#/features/review/model';
import { annexLine } from '#/features/review/photo';

const t = createTranslator(DEFAULT_LOCALE);

const BOX = {
  weightKg: { unit: 'kg', inputMode: 'decimal' },
  pieces: { unit: undefined, inputMode: 'text' },
  service: { unit: undefined, inputMode: 'text' },
  reference: { unit: undefined, inputMode: 'text' },
} as const;

/**
 * A weight, a « n/N », a service or a reference read « à vérifier »
 * (§4.4), after the number and the recipient: « Garder » keeps the value
 * read, a value typed in the box replaces it; either is sure from then on.
 */
export function AnnexStep({
  draft,
  field,
  photo,
  ...frame
}: StepProps & { field: AnnexField }) {
  const read = annexText(field, draft.annex);
  const [value, setValue] = useState(read);
  const [refused, setRefused] = useState(false);
  const submitting = useRef(false);
  const changed = value.trim() !== read;
  const line = annexLine(draft.ocrLines, field, read);

  const fields: ScanField[] = [
    ...(draft.recipient
      ? [{ label: t('scan.field.recipient'), value: draft.recipient.name }]
      : []),
    ...(draft.tracking
      ? [{ label: t('scan.field.tracking'), value: draft.tracking, mono: true }]
      : []),
  ];

  const onSubmit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      setRefused(!(await settleAnnex(db, draft.id, field, value)));
    } finally {
      submitting.current = false;
    }
  };

  return (
    <VerifierChampScreen
      {...frame}
      photo={photo && { ...photo, focus: line?.box ?? photo.focus }}
      question={t(`review.annex.${field}.question`)}
      fieldLabel={t(`review.annex.${field}.label`)}
      read={field === 'weightKg' ? `${read} kg` : read}
      value={value}
      onChange={(next) => {
        setValue(next);
        setRefused(false);
      }}
      unit={BOX[field].unit}
      inputMode={BOX[field].inputMode}
      error={refused ? t(`review.annex.${field}.invalid`) : undefined}
      submitLabel={changed ? t('review.annex.correct') : t('review.annex.keep')}
      fields={fields}
      onSubmit={() => void onSubmit()}
    />
  );
}
