import { commitLocal, type Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import {
  findByEmail,
  fullName,
  isEmail,
  normalizeEmail,
} from '#/features/directory/people';
import { parcelEvent } from '#/features/parcels/events';

/**
 * The card an address belongs to: a directory person, a contact outside
 * it, or nobody (a mail written to an address typed on the parcel).
 */
export type AddressCard =
  | { kind: 'person'; person: LocalDirectoryPerson }
  | { kind: 'contact'; contact: LocalContact }
  | { kind: 'none' };

export async function cardOf(
  db: CourrierDatabase,
  {
    personId,
    contactId,
  }: { personId: string | null; contactId: string | null },
): Promise<AddressCard> {
  const person = personId ? await db.directoryPerson.get(personId) : undefined;
  if (person && !person.deletedAt) return { kind: 'person', person };
  const contact = contactId ? await db.contact.get(contactId) : undefined;
  if (contact && !contact.deletedAt) return { kind: 'contact', contact };
  return { kind: 'none' };
}

/**
 * Whether the fix may go on the card. The directory is built in the app
 * (YSL-45, `manuel`): any agent corrects it, as they add to it. A card
 * synced from the company's directory (`entra`) is fixed at its source;
 * the address then goes on the parcels of this mail only.
 */
export function cardEditable(card: AddressCard): boolean {
  return (
    card.kind === 'contact' ||
    (card.kind === 'person' && card.person.source === 'manuel')
  );
}

export type AddressCheck =
  | { kind: 'ok'; address: string }
  | { kind: 'invalid' }
  /** Another card already holds the address: the directory keeps one card per e-mail. */
  | { kind: 'duplicate'; name: string };

/**
 * Whether `typed` can become the card's address. The directory never holds
 * two cards with one e-mail (F50, `directory_person_email_idx`), and a
 * contact never takes the address of someone else, person or contact: the
 * agent picks that card on the parcel instead. Written on the parcels
 * only, any well-formed address goes.
 */
export async function checkAddress(
  db: CourrierDatabase,
  card: AddressCard,
  typed: string,
  onCard: boolean,
): Promise<AddressCheck> {
  const address = normalizeEmail(typed);
  if (!isEmail(address)) return { kind: 'invalid' };
  if (!onCard || !cardEditable(card)) return { kind: 'ok', address };
  const person = await findByEmail(
    db,
    address,
    card.kind === 'person' ? card.person.id : undefined,
  );
  if (person) return { kind: 'duplicate', name: fullName(person) };
  if (card.kind === 'contact') {
    const contacts = await db.contact
      .where('email')
      .equalsIgnoreCase(address)
      .toArray();
    const other = contacts.find(
      (row) => row.id !== card.contact.id && !row.deletedAt,
    );
    if (other) return { kind: 'duplicate', name: other.name };
  }
  return { kind: 'ok', address };
}

export type FixAddress = {
  card: AddressCard;
  parcelIds: readonly string[];
  address: string;
  /** "Mettre à jour la fiche", ticked: the card takes it, not only this mail. */
  onCard: boolean;
};

export type FixedAddress = {
  kind: 'fixed';
  address: string;
  /** Where it went: the card, or the parcels of the mail when the card could not take it. */
  wrote: 'card' | 'parcels';
};

/**
 * Writes a corrected address, local first and queued for `sync.push`. On
 * the card, the parcels lose an address typed on them, which would
 * otherwise win over the card's (`addressOf`); on the parcels only, each
 * takes the address as its notification e-mail. Checked again here: a
 * card taken meanwhile sends the address to the parcels instead.
 */
export async function fixAddress(
  db: CourrierDatabase,
  { card, parcelIds, address: typed, onCard }: FixAddress,
  { agentId, now = new Date() }: { agentId: string; now?: Date },
): Promise<FixedAddress | { kind: 'invalid' }> {
  const check = await checkAddress(db, card, typed, onCard);
  if (check.kind === 'invalid') return check;
  const address = normalizeEmail(typed);
  const wrote =
    onCard && check.kind === 'ok' && cardEditable(card) ? 'card' : 'parcels';
  const parcels = (await db.parcel.bulkGet([...parcelIds])).flatMap((parcel) =>
    parcel && !parcel.deletedAt ? [parcel] : [],
  );
  const options = { agentId, now };
  const upserts: Upsert[] = [];
  if (wrote === 'card' && card.kind === 'person')
    upserts.push({
      entity: 'directory_person',
      row: { ...card.person, email: address, updatedAt: now },
    });
  if (wrote === 'card' && card.kind === 'contact')
    upserts.push({
      entity: 'contact',
      row: { ...card.contact, email: address, updatedAt: now },
    });
  for (const parcel of parcels) {
    const notificationEmail = wrote === 'card' ? null : address;
    if ((parcel.notificationEmail ?? null) === notificationEmail) continue;
    upserts.push(
      {
        entity: 'parcel',
        row: { ...parcel, notificationEmail, updatedAt: now },
      },
      parcelEvent(
        parcel.id,
        { type: 'parcel.edited', fields: ['notificationEmail'] },
        options,
      ),
    );
  }
  await commitLocal(db, { upserts }, { now });
  return { kind: 'fixed', address, wrote };
}
