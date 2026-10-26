import { normalizeName } from '@repo/shared/text';
import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import { fullName, normalizeEmail } from '#/features/directory/people';
import type { RecipientChoice } from '#/features/parcels/edit';
import { initialsOf } from '#/features/settings/initials';

/** A row of the recipient picker: a card of the directory or a contact typed once. */
export type RecipientOption = {
  choice: Extract<RecipientChoice, { kind: 'person' | 'contact' }>;
  name: string;
  initials: string;
  /** The department, else the e-mail: what tells two homonyms apart. */
  detail?: string;
  email?: string;
};

export function personOption(person: LocalDirectoryPerson): RecipientOption {
  const name = fullName(person);
  return {
    choice: { kind: 'person', id: person.id },
    name,
    initials: initialsOf(name),
    detail: person.department ?? undefined,
    email: person.email,
  };
}

export function contactOption(contact: LocalContact): RecipientOption {
  return {
    choice: { kind: 'contact', id: contact.id },
    name: contact.name,
    initials: initialsOf(contact.name),
    email: contact.email ?? undefined,
  };
}

/** Everyone a parcel can be for: active cards first, then contacts typed by hand. */
export type RecipientBook = {
  people: readonly LocalDirectoryPerson[];
  contacts: readonly LocalContact[];
  /** Ids of the latest recipients, newest first, for the "Récents" rows. */
  recent: readonly string[];
};

export async function loadRecipientBook(
  db: CourrierDatabase,
): Promise<RecipientBook> {
  const [people, contacts, latest] = await Promise.all([
    db.directoryPerson.toArray(),
    db.contact.toArray(),
    // Ids are UUID v7: their order is the order the parcels came in.
    db.parcel.orderBy(':id').reverse().limit(60).toArray(),
  ]);
  const recent = [
    ...new Set(
      latest.flatMap((parcel) => {
        const id = parcel.personId ?? parcel.contactId;
        return id && !parcel.deletedAt ? [id] : [];
      }),
    ),
  ];
  return {
    people: people.filter((person) => person.active && !person.deletedAt),
    contacts: contacts.filter((contact) => !contact.deletedAt),
    recent,
  };
}

const RECENTS = 5;

/**
 * What the picker lists: with a search, the people and contacts whose name,
 * department or e-mail match, accents and case aside, in alphabetical order;
 * without one, the latest recipients.
 */
export function pickRecipients(
  book: RecipientBook,
  query: string,
): { results: RecipientOption[]; recents: RecipientOption[] } {
  const needle = normalizeName(query);
  const mail = normalizeEmail(query);
  const matches = (name: string, ...others: (string | null | undefined)[]) =>
    normalizeName(name).includes(needle) ||
    others.some((other) => other && normalizeName(other).includes(needle)) ||
    (mail !== '' &&
      others.some((other) => other?.toLowerCase().includes(mail)));
  if (!needle && !mail) {
    const byId = new Map<string, RecipientOption>([
      ...book.people.map((p): [string, RecipientOption] => [
        p.id,
        personOption(p),
      ]),
      ...book.contacts.map((c): [string, RecipientOption] => [
        c.id,
        contactOption(c),
      ]),
    ]);
    return {
      results: [],
      recents: book.recent
        .flatMap((id) => byId.get(id) ?? [])
        .slice(0, RECENTS),
    };
  }
  const results = [
    ...book.people
      .filter((person) =>
        matches(fullName(person), person.department, person.email),
      )
      .map(personOption),
    ...book.contacts
      .filter((contact) => matches(contact.name, contact.email))
      .map(contactOption),
  ].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return { results, recents: [] };
}
