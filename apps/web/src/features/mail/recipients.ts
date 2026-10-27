import { damageNotice, mailValues, type MailValues } from '@repo/contract/mail';
import { damageForEmail } from '@repo/contract/parcel-damage';
import type { PickupSetting } from '@repo/contract/settings';
import type { TranslateFn } from '@repo/shared/i18n';
import type { LocalParcel } from '#/features/db/schema';
import {
  carrierLabel,
  formatTime,
  recipientOf,
  shortDate,
  startOfDay,
  type RecipientContext,
} from '#/features/parcels/model';

/**
 * One e-mail to write: who it goes to and every parcel of theirs waiting
 * for a first notice (F34, D12: one mail per person, sent when the agent
 * says). `address` is null when nobody typed one: the mail cannot leave.
 */
export type RecipientMail = {
  key: string;
  personId: string | null;
  contactId: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  parcels: LocalParcel[];
};

/** Received, not notified yet, and its record says who it is for. */
export function awaitsNotice(parcel: LocalParcel): boolean {
  return (
    !parcel.deletedAt &&
    parcel.status === 'recu' &&
    (parcel.personId !== null || parcel.contactId !== null)
  );
}

/** The address a parcel's notice goes to: the one typed on it, else its recipient's. */
export function addressOf(
  parcel: LocalParcel,
  context: RecipientContext,
): string | null {
  const { person, contact } = recipientOf(parcel, context);
  const address =
    parcel.notificationEmail?.trim() ||
    person?.email.trim() ||
    contact?.email?.trim();
  return address || null;
}

/**
 * The mails for these parcels, one per address: a directory person and a
 * contact sharing an address are one human and get one mail, named after
 * the directory. Without an address, one block per person or contact, kept
 * to say what is missing. By name, then by address.
 */
export function groupByRecipient(
  parcels: readonly LocalParcel[],
  context: RecipientContext,
): RecipientMail[] {
  const mails = new Map<string, RecipientMail>();
  const byReception = [...parcels]
    .filter(awaitsNotice)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  for (const parcel of byReception) {
    const { person, contact } = recipientOf(parcel, context);
    const address = addressOf(parcel, context);
    const key = address
      ? address.toLowerCase()
      : `${parcel.personId ? 'person' : 'contact'}:${parcel.personId ?? parcel.contactId}`;
    const mail = mails.get(key);
    if (mail && (mail.personId || !person)) {
      mail.parcels.push(parcel);
      continue;
    }
    const named = person
      ? {
          personId: person.id,
          contactId: null,
          name: `${person.firstName} ${person.lastName}`.trim(),
          firstName: person.firstName,
          lastName: person.lastName,
        }
      : {
          personId: null,
          contactId: parcel.contactId,
          name: contact?.name ?? '',
          // A contact has one name: its first word greets ("Bonjour
          // Marc"), the whole of it stands for {nom}.
          firstName: contact?.name.trim().split(/\s+/)[0] ?? null,
          lastName: contact?.name ?? null,
        };
    mails.set(key, {
      key,
      address,
      ...named,
      parcels: [...(mail?.parcels ?? []), parcel],
    });
  }
  return [...mails.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'fr') ||
      (a.address ?? '').localeCompare(b.address ?? ''),
  );
}

/** "UPS ···0622", as the desk names a parcel. */
function parcelName(parcel: LocalParcel, t: TranslateFn): string {
  const carrier = carrierLabel(parcel, t);
  return parcel.tracking
    ? `${carrier} ···${parcel.tracking.slice(-4)}`
    : carrier;
}

/** "UPS ···0622, reçu à 10 h 15" today, "…, reçu le 14 oct." before. */
export function parcelLine(
  parcel: LocalParcel,
  now: Date,
  t: TranslateFn,
): string {
  const name = parcelName(parcel, t);
  return parcel.receivedAt >= startOfDay(now)
    ? t('mail.parcel.today', { name, time: formatTime(parcel.receivedAt) })
    : t('mail.parcel.before', {
        name,
        date: shortDate(parcel.receivedAt, now),
      });
}

export type MailContext = {
  pickup: PickupSetting;
  /** The agent's name, the mail's signature. */
  agent: string | null;
  replyTo: string | null;
  code: string | null;
  now: Date;
  t: TranslateFn;
};

/** What the template's variables say in this recipient's mail. */
export function recipientValues(
  mail: RecipientMail,
  { pickup, agent, replyTo, code, now, t }: MailContext,
): MailValues {
  return mailValues({
    firstName: mail.firstName,
    lastName: mail.lastName,
    code,
    parcels: mail.parcels.map((parcel) => parcelLine(parcel, now, t)),
    damages: mail.parcels.flatMap((parcel) => {
      const damage = damageForEmail(parcel);
      return damage ? [damageNotice(parcelName(parcel, t), damage)] : [];
    }),
    pickup,
    agent,
    replyTo,
  });
}
