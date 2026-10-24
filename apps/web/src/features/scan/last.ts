import type { TranslateFn } from '@repo/shared/i18n';
import type { DraftParcel } from '#/features/db/schema';

export type LastScan = { name: string; meta: string };

/** The "Dernier ajouté" line: who, then carrier and last digits, or "Lecture…". */
export function lastOf(draft: DraftParcel, t: TranslateFn): LastScan {
  const name = draft.readName ?? t('parcel.recipient.unknown');
  if (draft.reading === 'pending') return { name, meta: t('scan.reading') };
  const carrier = draft.carrier ?? t('parcel.carrier.unknown');
  const last4 = draft.tracking ? draft.tracking.slice(-4) : '';
  return { name, meta: last4 ? `${carrier} ···${last4}` : carrier };
}
