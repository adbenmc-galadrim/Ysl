import {
  type TrackingContext,
  trackingContexts,
  validateTracking,
} from '@repo/contract/tracking';
import type { TranslateFn } from '@repo/shared/i18n';
import { carrierName } from '#/features/scan/carriers';

export type TrackingCheck = {
  tone: 'green' | 'orange' | 'red';
  text: string;
};

/** The carriers of the form's list, by the name the parcel keeps. */
export function carrierOptions(t: TranslateFn) {
  return trackingContexts.map((context) => {
    const name = carrierName(context, t);
    return { value: name, label: name };
  });
}

function contextOf(
  carrier: string,
  t: TranslateFn,
): TrackingContext | undefined {
  return trackingContexts.find(
    (context) => carrierName(context, t) === carrier,
  );
}

/**
 * The line under the tracking number, checked again at each keystroke
 * against the carrier picked (§4.6): the key of the carrier's format, or
 * the format alone where the carrier prints no key. The number is kept
 * whatever it says (§4.5); without a carrier, the one the number names is
 * offered.
 */
export function checkTracking(
  tracking: string,
  carrier: string,
  t: TranslateFn,
): { check?: TrackingCheck; carrier?: string } {
  if (!tracking.trim()) return {};
  const context = contextOf(carrier, t);
  const verdict = validateTracking(
    tracking,
    context && context !== 'other' ? { context } : {},
  );
  const named = verdict.carrier ? carrierName(verdict.carrier, t) : undefined;
  if (!context || context === 'other') {
    if (verdict.status !== 'sure' || !named) return {};
    return {
      check: {
        tone: 'green',
        text: t('edit.tracking.recognized', { carrier: named }),
      },
      carrier: carrier ? undefined : named,
    };
  }
  switch (verdict.reason) {
    case 'valid-key':
      return verdict.status === 'sure'
        ? {
            check: {
              tone: 'green',
              text: t('edit.tracking.valid', { carrier }),
            },
          }
        : {
            check: {
              tone: 'orange',
              text: t('edit.tracking.likely', { carrier }),
            },
          };
    case 'format-and-context':
      return {
        check: {
          tone: 'green',
          text: t('edit.tracking.recognized', { carrier }),
        },
      };
    case 'invalid-key':
      return {
        check: { tone: 'red', text: t('edit.tracking.invalid', { carrier }) },
      };
    case 'context-mismatch':
    case 'unknown-format':
      return {
        check: {
          tone: 'orange',
          text: t('edit.tracking.mismatch', { carrier }),
        },
      };
    default:
      return {
        check: { tone: 'orange', text: t('edit.tracking.likely', { carrier }) },
      };
  }
}
