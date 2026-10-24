import type { TranslateFn } from '@repo/shared/i18n';
import type { LastParcel } from '@repo/ui';
import type { DraftParcel } from '#/features/db/schema';

/** The name a code gave, else the OCR's guess with its doubt, else unknown. */
export function nameOf(draft: DraftParcel, t: TranslateFn): string {
  if (draft.readName) return draft.readName;
  if (draft.ocrName) return `${draft.ocrName} ?`;
  return t('parcel.recipient.unknown');
}

/** "UPS ···0622": the carrier, then the last digits of the number when there is one. */
export function carrierMeta(
  carrier: string | null,
  tracking: string | null,
  t: TranslateFn,
): string {
  const name = carrier ?? t('parcel.carrier.unknown');
  const last4 = tracking ? tracking.slice(-4) : '';
  return last4 ? `${name} ···${last4}` : name;
}

/**
 * The "Dernier ajouté" line: who, then carrier and last digits, or
 * "Lecture…" while it reads; a photo that gave nothing says so instead,
 * with the alert, so the band never passes it off as a parcel read; a
 * parcel read without its carrier or its number is flagged to look at.
 */
export function lastOf(draft: DraftParcel, t: TranslateFn): LastParcel {
  const name = nameOf(draft, t);
  if (draft.reading === 'pending') return { name, meta: t('scan.reading') };
  if (draft.reading === 'unreadable') {
    return { name, meta: t('scan.last.unread'), status: 'error' };
  }
  if (draft.reading === 'failed') {
    return { name, meta: t('scan.last.failed'), status: 'error' };
  }
  const meta = carrierMeta(draft.carrier, draft.tracking, t);
  if (draft.carrier && draft.tracking) return { name, meta };
  return { name, meta, status: 'warning' };
}
