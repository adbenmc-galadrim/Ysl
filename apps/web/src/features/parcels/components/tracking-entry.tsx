import { trackingContexts } from '@repo/contract/tracking';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { SaisieManuelleSheet, TransporteurSheet } from '@repo/ui';
import { useState } from 'react';
import { carrierName } from '#/features/scan/carriers';
import { appendTyped, groupTyped, typedEntry } from '#/features/scan/typed';

const t = createTranslator(DEFAULT_LOCALE);

/** The carriers the sheet offers; « Autre » is the sheet's own, typed. */
const CARRIERS = trackingContexts
  .filter((context) => context !== 'other')
  .map((context) => carrierName(context, t));

export type TrackingEntered = { tracking: string; carrier: string };

export type TrackingEntryProps = {
  /** The number so far, typed again from it. */
  initial?: string | null;
  /** The number holds: only its carrier is asked. */
  carrierFor?: string;
  onDone: (entered: TrackingEntered) => void;
  onClose: () => void;
};

/**
 * The number typed by hand (YSL-24's pad, checked as the characters come)
 * then, when its format names no carrier, the carrier chosen among the
 * known ones or typed under « Autre » (§4.4).
 */
export function TrackingEntry({
  initial,
  carrierFor,
  onDone,
  onClose,
}: TrackingEntryProps) {
  const [value, setValue] = useState(() => appendTyped('', initial ?? ''));
  const [number, setNumber] = useState<string | null>(carrierFor ?? null);

  if (number !== null) {
    return (
      <TransporteurSheet
        fixed
        tracking={groupTyped(number)}
        carriers={CARRIERS}
        onPick={(carrier) => onDone({ tracking: number, carrier })}
        onDismiss={onClose}
      />
    );
  }

  const entry = typedEntry(value, t);
  return (
    <SaisieManuelleSheet
      fixed
      value={entry.grouped}
      hint={entry.hint ?? undefined}
      submitLabel={t('scan.type.save')}
      onDigit={(key) => setValue((typed) => appendTyped(typed, key))}
      onLetter={(key) => setValue((typed) => appendTyped(typed, key))}
      onDelete={() => setValue((typed) => typed.slice(0, -1))}
      onSubmit={() => {
        if (!entry.tracking) return;
        if (entry.carrier) {
          onDone({ tracking: entry.tracking, carrier: entry.carrier });
        } else {
          setNumber(entry.tracking);
        }
      }}
      onDismiss={onClose}
    />
  );
}
