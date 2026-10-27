import { SUGGESTIONS } from '@repo/contract/recipient';
import { validateTracking } from '@repo/contract/tracking';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  type ScanField,
  type TrackingChoice,
  VerifierSuiviScreen,
} from '@repo/ui';
import { useRef, useState } from 'react';
import { db } from '#/features/db/database';
import { TrackingEntry } from '#/features/parcels/components/tracking-entry';
import {
  setDraftCarrier,
  typeDraftTracking,
  untrackDraft,
} from '#/features/review/actions';
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
 * button confirms it; below 0,60 the readings wait as choices; unread, the
 * agent types it. A number whose format names no carrier asks for one;
 * « Sans suivi » gives the parcel the app's own number. Either way the
 * agent's answer is sure (`trackingConfirmed`), F26 can notify.
 */
export function TrackingStep({
  draft,
  level,
  photo,
  submitLabel,
  ...frame
}: StepProps & { level: 'to-verify' | 'none' | 'carrier' }) {
  const { tracking, extraction } = draftFields(draft);
  const own = draft.trackingNorm ?? draft.tracking;
  const values = [
    ...(own ? [own] : []),
    ...suggestionsOf(extraction.tracking).filter((value) => value !== own),
  ].slice(0, SUGGESTIONS);
  const [selected, setSelected] = useState(
    level === 'none' ? undefined : (tracking?.value ?? own ?? undefined),
  );
  const [entry, setEntry] = useState<'typed' | 'carrier' | null>(null);
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

  const once = async (write: () => Promise<unknown>) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await write();
    } finally {
      submitting.current = false;
    }
  };

  const onSubmit = async () => {
    if (!selected) return;
    const carrier = draft.carrier ?? choiceOf(selected).carrier;
    if (!carrier) {
      setEntry('carrier');
      return;
    }
    await once(() => pickTracking(draft.id, selected));
  };

  return (
    <>
      <VerifierSuiviScreen
        {...frame}
        photo={photo && { ...photo, focus: line?.box ?? photo.focus }}
        level={level}
        choices={values.map(choiceOf)}
        selected={selected}
        fields={fields}
        submitLabel={
          level === 'carrier' ? t('review.submit.carrier') : submitLabel
        }
        onSelect={setSelected}
        onSubmit={() => void onSubmit()}
        onType={() => setEntry('typed')}
        onUntracked={() => void once(() => untrackDraft(db, draft.id))}
      />
      {entry && (
        <TrackingEntry
          initial={entry === 'typed' ? own : undefined}
          carrierFor={entry === 'carrier' ? selected : undefined}
          onClose={() => setEntry(null)}
          onDone={({ tracking: number, carrier }) => {
            setEntry(null);
            void once(() =>
              entry === 'carrier' && number === own
                ? setDraftCarrier(db, draft.id, carrier)
                : typeDraftTracking(db, draft.id, {
                    tracking: number,
                    carrier,
                  }),
            );
          }}
        />
      )}
    </>
  );
}
