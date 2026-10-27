import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { type ScanField, VerifierChampScreen } from '@repo/ui';
import { useRef, useState } from 'react';
import { db } from '#/features/db/database';
import { nameLine } from '#/features/recipient/check';
import { settleSender } from '#/features/review/actions';
import type { StepProps } from '#/features/review/components/step';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * The sender read « à vérifier », or proposed by what earlier corrections
 * taught (§4.8): « Garder » confirms it, a name typed replaces it; either
 * way « Terminer » teaches the dictionary the `FROM` block the OCR read.
 */
export function SenderStep({ draft, photo, ...frame }: StepProps) {
  const read = draft.sender?.name ?? '';
  const [value, setValue] = useState(read);
  const submitting = useRef(false);
  const changed = value.trim() !== read;
  const line = nameLine(draft.ocrLines, draft.sender?.read ?? read);

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
      await settleSender(db, draft.id, value);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <VerifierChampScreen
      {...frame}
      photo={photo && { ...photo, focus: line?.box ?? photo.focus }}
      question={t('review.sender.question')}
      fieldLabel={t('review.sender.label')}
      read={draft.sender?.read ?? read}
      value={value}
      onChange={setValue}
      inputMode="text"
      submitLabel={changed ? t('review.annex.correct') : t('review.annex.keep')}
      fields={fields}
      onSubmit={() => void onSubmit()}
    />
  );
}
