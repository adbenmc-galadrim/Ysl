import { SUGGESTIONS } from '@repo/contract/recipient';
import { validateTracking } from '@repo/contract/tracking';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  type ScanField,
  type TrackingChoice,
  VerifierSuiviScreen,
} from '@repo/ui';
import { useRef, useState } from 'react';
import type { StepProps } from '#/features/review/components/step';
import { trackingLine } from '#/features/review/photo';
import { carrierName } from '#/features/scan/carriers';
import { draftFields } from '#/features/scan/confidence';
import { pickTracking } from '#/features/scan/confirm';
import { suggestionsOf } from '#/features/scan/reading';

const t = createTranslator(DEFAULT_LOCALE);

const choiceOf = (value: string): TrackingChoice => {
  const { carrier } = validateTracking(value);
  return { value, carrier: carrier ? carrierName(carrier, t) : undefined };
};

/**
 * The number (§4.4): « à vérifier », it comes chosen and one tap on the
 * button confirms it; below 0,60 the readings wait as choices. Either way
 * the agent's answer is sure (`trackingConfirmed`), F26 can notify.
 */
export function TrackingStep({
  draft,
  level,
  photo,
  submitLabel,
  ...frame
}: StepProps & { level: 'to-verify' | 'none' }) {
  const { tracking, extraction } = draftFields(draft);
  const own = draft.trackingNorm ?? draft.tracking;
  const values = [
    ...(own ? [own] : []),
    ...suggestionsOf(extraction.tracking).filter((value) => value !== own),
  ].slice(0, SUGGESTIONS);
  const [selected, setSelected] = useState(
    level === 'to-verify' ? (tracking?.value ?? own ?? undefined) : undefined,
  );
  const submitting = useRef(false);
  const line = trackingLine(draft.ocrLines, selected ?? own);

  const fields: ScanField[] = [
    ...(draft.carrier
      ? [{ label: t('scan.field.carrier'), value: draft.carrier }]
      : []),
    ...(draft.recipient
      ? [{ label: t('scan.field.recipient'), value: draft.recipient.name }]
      : []),
  ];

  const onSubmit = async () => {
    if (!selected || submitting.current) return;
    submitting.current = true;
    try {
      await pickTracking(draft.id, selected);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <VerifierSuiviScreen
      {...frame}
      photo={photo && { ...photo, focus: line?.box ?? photo.focus }}
      level={level}
      choices={values.map(choiceOf)}
      selected={selected}
      fields={fields}
      submitLabel={submitLabel}
      onSelect={setSelected}
      onSubmit={() => void onSubmit()}
    />
  );
}
