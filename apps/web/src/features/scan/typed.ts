import {
  normalizeTracking,
  validateTracking,
  type TrackingContext,
  type TrackingVerdict,
} from '@repo/contract/tracking';
import type { TranslateFn } from '@repo/shared/i18n';
import type { SaisieManuelleHint } from '@repo/ui';
import type { TypedTracking } from '#/features/batch/store';
import { CARRIER_LABELS } from '#/features/scan/extract';

/** Longer than any tracking number read so far (FedEx 96: 22). */
export const MAX_TYPED = 30;

export type TypedEntry = TypedTracking & {
  /** The value as the field shows it: groups of four. */
  grouped: string;
  context: TrackingContext | null;
  verdict: TrackingVerdict;
  hint: SaisieManuelleHint | null;
};

/** What a key adds to the value: upper case, nothing but letters and digits. */
export function appendTyped(value: string, key: string): string {
  return normalizeTracking(value + key)
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_TYPED);
}

export function groupTyped(value: string): string {
  return value.replace(/(.{4})(?=.)/g, '$1 ');
}

/**
 * The verdict under the field, live. Silence while the number matches no
 * known format — that is what every half-typed number looks like — and a
 * word as soon as it does, so the agent knows before the last character.
 */
function hintOf(
  verdict: TrackingVerdict,
  carrier: string | null,
  t: TranslateFn,
): SaisieManuelleHint | null {
  switch (verdict.status) {
    case 'sure':
      return carrier
        ? { tone: 'green', text: t('scan.type.recognized', { carrier }) }
        : null;
    case 'to-verify':
      return carrier
        ? { tone: 'orange', text: t('scan.type.likely', { carrier }) }
        : { tone: 'orange', text: t('scan.type.ambiguous') };
    case 'rejected':
      return verdict.candidates.length > 0
        ? { tone: 'red', text: t('scan.type.invalidKey') }
        : null;
  }
}

/**
 * The agent's own number is the number (§4.5): it is kept whatever the
 * verdict says. The carrier is the verdict's own — a format and its key,
 * or a format alone for the carriers whose key is no criterion (`to-verify`)
 * — or nothing at all: never a carrier guessed on length, nor one whose key
 * rejected the number.
 */
export function typedEntry(value: string, t: TranslateFn): TypedEntry {
  const verdict = validateTracking(value);
  const context = verdict.status === 'rejected' ? null : verdict.carrier;
  const carrier = context ? CARRIER_LABELS[context] : null;
  return {
    carrier,
    tracking: verdict.value,
    trackingNorm: verdict.value,
    grouped: groupTyped(verdict.value),
    context,
    verdict,
    hint: hintOf(verdict, carrier, t),
  };
}
