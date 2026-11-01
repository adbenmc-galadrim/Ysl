import type { TranslateFn } from '@repo/shared/i18n';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import { parcelsOnServer } from '#/features/mail/server-mail';

/** How the employees of a confirmed deposit stand: told, being told, left to the phone. */
export type DepositMails = { sent: number; sending: number; toSend: number };

/**
 * One count per recipient, as one mail per recipient leaves. A parcel still
 * « Déposé » was not told; `onServer`: the server is on it. Only those deposited:
 * a parcel held back is told once it is settled.
 */
export function countDepositMails(
  parcels: readonly LocalParcel[],
  onServer: ReadonlySet<string>,
): DepositMails {
  const told = new Set<string>();
  const sending = new Set<string>();
  const toSend = new Set<string>();
  for (const parcel of parcels) {
    const who = parcel.personId ?? parcel.contactId;
    if (!who || parcel.deletedAt) continue;
    if (parcel.status === 'notifie') told.add(who);
    else if (parcel.status !== 'depose') continue;
    else if (onServer.has(parcel.id)) sending.add(who);
    else toSend.add(who);
  }
  return { sent: told.size, sending: sending.size, toSend: toSend.size };
}

export async function loadDepositMails(
  db: CourrierDatabase,
  parcelIds: readonly string[],
): Promise<DepositMails> {
  const parcels = await db.parcel.bulkGet([...parcelIds]);
  return countDepositMails(
    parcels.filter((parcel) => parcel !== undefined),
    await parcelsOnServer(db),
  );
}

/** The line of the confirmed screen: what is left says first; nothing to say, no line. */
export function depositMailRows(
  mails: DepositMails | undefined,
  t: TranslateFn,
): { icon: 'mail'; title: string; value: string }[] {
  if (!mails) return [];
  const { sent, sending, toSend } = mails;
  const value = toSend
    ? t('deposit.done.mails.toSend', { count: toSend })
    : sending
      ? t('deposit.done.mails.sending', { count: sending })
      : sent === 1
        ? t('deposit.done.mails.sent.one')
        : sent
          ? t('deposit.done.mails.sent', { count: sent })
          : null;
  return value ? [{ icon: 'mail', title: t('deposit.done.mails'), value }] : [];
}
