import { notifyParcel, type NotifyChange } from '@repo/contract/mail';
import type { RecipientKind } from '@repo/contract/recipient';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  pickupCodeWrites,
  pickupToWrite,
  type PickupSecret,
} from '#/features/mail/pickup-code';
import type { RecipientMail } from '#/features/mail/recipients';
import { parcelEvent } from '#/features/parcels/events';
import {
  contactOption,
  personOption,
  type Choice,
} from '#/features/recipient/options';

/** Someone told instead of a recipient without an address: a card or a contact with one. */
export type Relay = {
  kind: RecipientKind;
  id: string;
  name: string;
  address: string;
};

export type WayOptions = { userId: string; now?: Date };

/** What `contact.notify_via` holds: the card or contact told last time. */
export function relayKey({ kind, id }: Pick<Relay, 'kind' | 'id'>): string {
  return `${kind}:${id}`;
}

/** A chosen card or contact as the relay, if it has an address to write to. */
export function relayOf(choice: Choice): Relay | null {
  const address = choice.email?.trim();
  return address
    ? { kind: choice.kind, id: choice.id, name: choice.name, address }
    : null;
}

async function optionOfKey(
  db: CourrierDatabase,
  key: string,
): Promise<Choice | null> {
  const [kind, id] = key.split(':');
  if (!id) return null;
  if (kind === 'person') {
    const person = await db.directoryPerson.get(id);
    return person?.active && !person.deletedAt ? personOption(person) : null;
  }
  if (kind === 'contact') {
    const contact = await db.contact.get(id);
    return contact && !contact.deletedAt ? contactOption(contact) : null;
  }
  return null;
}

/**
 * Who was told for this recipient last time, offered first (F25): the
 * contact's `notifyVia`, else the address of the last mail sent through
 * someone, found again among the cards and contacts.
 */
export async function rememberedRelay(
  db: CourrierDatabase,
  { personId, contactId }: Pick<RecipientMail, 'personId' | 'contactId'>,
): Promise<Choice | null> {
  const contact = contactId ? await db.contact.get(contactId) : undefined;
  if (contact?.notifyVia) {
    const remembered = await optionOfKey(db, contact.notifyVia);
    if (remembered) return remembered;
  }
  const mails = personId
    ? await db.notification.where('personId').equals(personId).toArray()
    : contactId
      ? await db.notification.where('contactId').equals(contactId).toArray()
      : [];
  const last = mails
    .filter((mail) => !mail.deletedAt && mail.relayName && mail.sentAt)
    .sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime())[0];
  const address = last?.recipients[0]?.toLowerCase();
  if (!address) return null;
  const person = (
    await db.directoryPerson.where('email').equals(address).toArray()
  ).find((row) => row.active && !row.deletedAt);
  if (person) return personOption(person);
  const known = (
    await db.contact.where('email').equals(address).toArray()
  ).find((row) => !row.deletedAt);
  return known ? contactOption(known) : null;
}

/**
 * The mail through someone was confirmed sent: the contact remembers who
 * was told for them, and when the agent ticked « Il viendra le chercher »
 * the parcels now notified expect that person at the desk (YSL-70).
 */
export async function recordRelay(
  db: CourrierDatabase,
  {
    mail,
    relay,
    collects,
  }: { mail: RecipientMail; relay: Relay; collects: boolean },
  { now = new Date() }: { now?: Date } = {},
): Promise<void> {
  const upserts: Upsert[] = [];
  const contact = mail.contactId
    ? await db.contact.get(mail.contactId)
    : undefined;
  const key = relayKey(relay);
  if (contact && !contact.deletedAt && contact.notifyVia !== key) {
    upserts.push({
      entity: 'contact',
      row: { ...contact, notifyVia: key, updatedAt: now },
    });
  }
  if (collects) {
    const parcels = await db.parcel.bulkGet(mail.parcels.map(({ id }) => id));
    for (const parcel of parcels) {
      if (
        parcel &&
        !parcel.deletedAt &&
        parcel.status === 'notifie' &&
        parcel.expectedDelegate !== relay.name
      ) {
        upserts.push({
          entity: 'parcel',
          row: { ...parcel, expectedDelegate: relay.name, updatedAt: now },
        });
      }
    }
  }
  if (upserts.length) await commitLocal(db, { upserts }, { now });
}

export type InformResult = {
  changes: NotifyChange[];
  /** False when nothing was left to tell: every parcel already was. */
  written: boolean;
};

/**
 * « De vive voix » (F25): the agent told the recipient in person or on the
 * phone. Their parcels become notified as a confirmed mail would make them,
 * each with its history line, and the PIN the agent reads out becomes the
 * recipient's code, so the desk can hand over by code. A notice tells only
 * the parcels still received; a reminder dates the notified ones, quoting
 * the open code (`recallSecrets`) without writing it again.
 */
export async function informOrally(
  db: CourrierDatabase,
  {
    mail,
    secret,
    reminder,
  }: { mail: RecipientMail; secret: PickupSecret; reminder: boolean },
  { userId, now = new Date() }: WayOptions,
): Promise<InformResult> {
  const ids = mail.parcels.map(({ id }) => id);
  const parcels = await db.parcel.bulkGet(ids);
  const changes = ids.map((parcelId, index): NotifyChange => {
    const parcel = parcels[index];
    if (!parcel) return { parcelId, skip: 'missing' };
    const change = notifyParcel(parcel, { sentAt: now, agentId: userId });
    return 'skip' in change || change.reminder === reminder
      ? change
      : { parcelId, skip: 'closed' };
  });
  const told = changes.flatMap((change, index) =>
    'skip' in change ? [] : [{ change, parcel: parcels[index]! }],
  );
  if (!told.length) return { changes, written: false };
  const pickup = pickupToWrite(secret, { withQr: false });
  const codes = pickup
    ? await pickupCodeWrites(
        db,
        { personId: mail.personId, contactId: mail.contactId },
        pickup,
        { now },
      )
    : [];
  await commitLocal(
    db,
    {
      upserts: [
        ...codes,
        ...told.flatMap(({ change, parcel }): Upsert[] => [
          { entity: 'parcel', row: { ...parcel, ...change.patch } },
          parcelEvent(
            change.parcelId,
            {
              type: 'parcel.informed',
              kind: change.reminder ? 'relance' : 'avis',
            },
            { agentId: userId, now },
          ),
        ]),
      ],
    },
    { now },
  );
  return { changes, written: true };
}
