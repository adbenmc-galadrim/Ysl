import {
  damageNotice,
  mailValues,
  type MailValues,
  replyReference,
} from '@repo/contract/mail';
import { damageForEmail } from '@repo/contract/parcel-damage';
import type { PickupSetting } from '@repo/contract/settings';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { fullName } from '#/features/directory/people';
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
 * for a first notice (F34, D12: one mail per person and per department, sent
 * when the agent says). `address` is null when nobody typed one: the mail cannot leave.
 */
export type RecipientMail = {
  key: string;
  personId: string | null;
  contactId: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  /** The department of these parcels: its code opens nowhere else (§3.7.9). */
  departmentId?: string | null;
  parcels: LocalParcel[];
};

/**
 * Who a mail greets and names: the directory person, else the contact. A
 * contact has one name: its first word greets ("Bonjour Marc"), the whole
 * of it stands for {nom}.
 */
export function namedRecipient(
  person: LocalDirectoryPerson | undefined,
  contactId: string | null,
  contact: LocalContact | undefined,
): Pick<
  RecipientMail,
  'personId' | 'contactId' | 'name' | 'firstName' | 'lastName'
> {
  if (person)
    return {
      personId: person.id,
      contactId: null,
      name: fullName(person),
      firstName: person.firstName,
      lastName: person.lastName,
    };
  return {
    personId: null,
    contactId,
    name: contact?.name ?? '',
    firstName: contact?.name.trim().split(/\s+/)[0] ?? null,
    lastName: contact?.name ?? null,
  };
}

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
 * The parcel's department; the server sets it, so one just written here
 * reads its person's until the next pull.
 */
export function departmentOfParcel(
  parcel: Pick<LocalParcel, 'departmentId'>,
  person: Pick<LocalDirectoryPerson, 'departmentId'> | undefined,
): string | null {
  return parcel.departmentId ?? person?.departmentId ?? null;
}

/**
 * The mails for these parcels, one per address and per department, each
 * with its code: a directory person and a
 * contact sharing an address are one human and get one mail, named after
 * the directory. Without an address, one block per person or contact, kept
 * to say what is missing. By name, then by address. `keep`: the parcels a
 * mail is about, those awaiting their first notice unless said otherwise.
 */
export function groupByRecipient(
  parcels: readonly LocalParcel[],
  context: RecipientContext,
  keep: (parcel: LocalParcel) => boolean = awaitsNotice,
): RecipientMail[] {
  const mails = new Map<string, RecipientMail>();
  const byReception = [...parcels]
    .filter(keep)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  for (const parcel of byReception) {
    const { person, contact } = recipientOf(parcel, context);
    const address = addressOf(parcel, context);
    const departmentId = departmentOfParcel(parcel, person);
    const who = address
      ? address.toLowerCase()
      : `${parcel.personId ? 'person' : 'contact'}:${parcel.personId ?? parcel.contactId}`;
    const key = departmentId ? `${who}|${departmentId}` : who;
    const mail = mails.get(key);
    if (mail && (mail.personId || !person)) {
      mail.parcels.push(parcel);
      continue;
    }
    const named = namedRecipient(person, parcel.contactId, contact);
    mails.set(key, {
      key,
      address,
      departmentId,
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

/**
 * The mails of one parcel's recipient, opened from its record: every mail
 * holding a parcel of the same person or contact, so one typed elsewhere
 * on another of their parcels is offered too.
 */
export function mailsAbout(
  mails: readonly RecipientMail[],
  parcelId: string,
): RecipientMail[] {
  const target = mails
    .flatMap((mail) => mail.parcels)
    .find(({ id }) => id === parcelId);
  if (!target) return [];
  return mails.filter((mail) =>
    mail.parcels.some(
      (parcel) =>
        parcel.id === parcelId ||
        (!!target.personId && parcel.personId === target.personId) ||
        (!!target.contactId && parcel.contactId === target.contactId),
    ),
  );
}

/**
 * The mails of a saved batch: every recipient with a parcel in it, each
 * mail still holding all their parcels to notify (D12: one mail per
 * person, and one pickup code — a second mail would replace it).
 */
export function mailsOfBatch(
  mails: readonly RecipientMail[],
  batchId: string,
): RecipientMail[] {
  return mails.filter((mail) =>
    mail.parcels.some((parcel) => parcel.batchId === batchId),
  );
}

/** "UPS ···0622", as the desk names a parcel. */
export function parcelName(parcel: LocalParcel, t: TranslateFn): string {
  const carrier = carrierLabel(parcel, t);
  return parcel.tracking
    ? `${carrier} ···${parcel.tracking.slice(-4)}`
    : carrier;
}

/**
 * One parcel as the mail lists it (§8.7): carrier and number, sender and
 * pieces when known, then when it came — "UPS ···0622, de Zalando, 2 pièces
 * sur 3, reçu à 10 h 15" today, "…, reçu le 14 oct." before.
 */
export function parcelLine(
  parcel: LocalParcel,
  now: Date,
  t: TranslateFn,
): string {
  const sender = parcel.senderName?.trim();
  const { pieceN, pieceTotal } = parcel;
  return [
    parcelName(parcel, t),
    sender && t('mail.parcel.sender', { sender }),
    pieceN && pieceTotal && pieceTotal > 1
      ? t(pieceN === 1 ? 'mail.parcel.piece' : 'mail.parcel.pieces', {
          n: pieceN,
          total: pieceTotal,
        })
      : undefined,
    parcel.receivedAt >= startOfDay(now)
      ? t('mail.parcel.today', { time: formatTime(parcel.receivedAt) })
      : t('mail.parcel.before', {
          date: shortDate(parcel.receivedAt, now),
        }),
  ]
    .filter(Boolean)
    .join(', ');
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
    replyReference: replyReference({
      trackings: mail.parcels.map((parcel) =>
        parcel.type === 'sans_suivi' ? null : parcel.tracking,
      ),
      name: mail.name,
    }),
  });
}
