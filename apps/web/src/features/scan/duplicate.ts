import type { TranslateFn } from '@repo/shared/i18n';
import type { ScanReading } from '@repo/ui';
import type { Duplicate } from '#/features/batch/duplicates';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import { formatTime, startOfDay } from '#/features/parcels/model';
import { carrierMeta, nameOf } from '#/features/scan/last';

export type DuplicateReading = Extract<ScanReading, { kind: 'duplicate' }>;

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

/** "aujourd’hui", "hier", "le 23 octobre": the day the title names. */
function dayOf(date: Date, now: Date, t: TranslateFn): string {
  const today = startOfDay(now);
  if (date >= today) return t('scan.duplicate.day.today');
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date >= yesterday) return t('scan.duplicate.day.yesterday');
  return t('scan.duplicate.day.on', { date: dateFormat.format(date) });
}

/**
 * Who the parcel is for: the directory entry or the contact it was given;
 * without either, the name read on the label stands in (the list keeps it
 * as a note, the alert has one line), else unknown.
 */
export async function recipientOf(
  db: CourrierDatabase,
  parcel: LocalParcel,
  t: TranslateFn,
): Promise<string> {
  if (parcel.personId) {
    const person = await db.directoryPerson.get(parcel.personId);
    if (person) return `${person.firstName} ${person.lastName}`;
  }
  if (parcel.contactId) {
    const contact = await db.contact.get(parcel.contactId);
    if (contact) return contact.name;
  }
  return parcel.readName ?? t('parcel.recipient.unknown');
}

/**
 * The alert of the Scan screen (P1.4): "Déjà dans ce lot" with the time the
 * original was scanned, or "Déjà reçu le …" (or remis) for a parcel of an
 * earlier batch, with who and what, then the line that nothing was added.
 */
export function duplicateReading(
  found: Duplicate,
  recipient: string,
  t: TranslateFn,
  now = new Date(),
): DuplicateReading {
  const message = t('scan.duplicate.message');
  if (found.kind === 'batch') {
    const { draft } = found;
    return {
      kind: 'duplicate',
      title: t('scan.duplicate.batch.title'),
      detail: t('scan.duplicate.batch.detail', {
        name: nameOf(draft, t),
        meta: carrierMeta(draft.carrier, draft.tracking, t),
        time: formatTime(draft.createdAt),
      }),
      message,
    };
  }
  const { parcel } = found;
  const delivered = parcel.status === 'remis' && parcel.deliveredAt;
  const at = delivered || parcel.receivedAt;
  const params = {
    name: recipient,
    meta: carrierMeta(parcel.carrier, parcel.tracking, t),
    time: formatTime(at),
  };
  const day = { day: dayOf(at, now, t) };
  return {
    kind: 'duplicate',
    title: delivered
      ? t('scan.duplicate.delivered.title', day)
      : t('scan.duplicate.received.title', day),
    detail: delivered
      ? t('scan.duplicate.delivered.detail', params)
      : t('scan.duplicate.received.detail', params),
    message,
  };
}
