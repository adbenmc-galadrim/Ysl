import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { normalizeName } from '@repo/shared/text';
import type { DirectoryEntry, OutsideContactDraft } from '@repo/ui';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import { isEmail, listed, normalizeEmail } from '#/features/directory/people';
import { parcelEvent } from '#/features/parcels/events';
import { initialsOf } from '#/features/settings/initials';

const t = createTranslator(DEFAULT_LOCALE);

const live = (contact: LocalContact) => contact.deletedAt === null;

/** A contact as the Annuaire lists it: its department, else its e-mail; « Sans e-mail » said either way. */
export function contactEntry(contact: LocalContact): DirectoryEntry {
  return {
    id: contact.id,
    name: contact.name,
    initials: initialsOf(contact.name),
    detail: contact.email
      ? (contact.department ?? contact.email)
      : [contact.department, t('contact.noEmail')].filter(Boolean).join(' · '),
  };
}

/**
 * The contacts outside the directory (F27) as Réglages › Annuaire lists
 * them: live ones, in alphabetical order, narrowed by a search on the
 * name, the department or the e-mail.
 */
export function contactEntries(
  contacts: readonly LocalContact[],
  query = '',
): DirectoryEntry[] {
  const needle = normalizeName(query);
  const mail = normalizeEmail(query);
  return contacts
    .filter(live)
    .filter(
      (contact) =>
        !needle ||
        contact.nameNorm.includes(needle) ||
        normalizeName(contact.department ?? '').includes(needle) ||
        (mail !== '' && (contact.email ?? '').includes(mail)),
    )
    .sort((a, b) => a.nameNorm.localeCompare(b.nameNorm))
    .map(contactEntry);
}

export function contactDraft(contact: LocalContact): OutsideContactDraft {
  return {
    name: contact.name,
    email: contact.email ?? '',
    department: contact.department ?? '',
  };
}

/**
 * The directory card a contact is the same human as, now that the
 * directory lists them: the same e-mail, or, for a contact without one,
 * the same name and nobody else under it. The agent decides; nothing is
 * merged without them.
 */
export function mergeTarget(
  contact: Pick<LocalContact, 'email' | 'nameNorm'>,
  people: readonly LocalDirectoryPerson[],
): LocalDirectoryPerson | null {
  const cards = people.filter(listed);
  if (contact.email) {
    const key = normalizeEmail(contact.email);
    return cards.find((person) => normalizeEmail(person.email) === key) ?? null;
  }
  const named = cards.filter((person) => person.nameNorm === contact.nameNorm);
  return named.length === 1 ? named[0]! : null;
}

export type ContactSave =
  | { kind: 'saved'; contact: LocalContact }
  | { kind: 'unchanged' }
  | { kind: 'invalid'; field: 'name' | 'email' }
  /** Another contact already has this e-mail: one contact per address. */
  | { kind: 'duplicate'; contact: LocalContact };

/**
 * Saves a contact's name, e-mail and department, local first and queued
 * for `sync.push`. An e-mail another contact holds is refused: the agent
 * uses that one instead. One a directory card holds is kept: the sheet
 * then offers to attach the contact to it.
 */
export async function saveContact(
  db: CourrierDatabase,
  id: string,
  draft: OutsideContactDraft,
  { now = new Date() }: { now?: Date } = {},
): Promise<ContactSave> {
  const known = await db.contact.get(id);
  if (!known || known.deletedAt) return { kind: 'unchanged' };
  const name = draft.name.trim().replace(/\s+/g, ' ');
  if (!name) return { kind: 'invalid', field: 'name' };
  const email = normalizeEmail(draft.email) || null;
  if (email && !isEmail(email)) return { kind: 'invalid', field: 'email' };
  if (email) {
    const other = (
      await db.contact.where('email').equals(email).toArray()
    ).find((row) => live(row) && row.id !== id);
    if (other) return { kind: 'duplicate', contact: other };
  }
  const department = draft.department.trim() || null;
  if (
    name === known.name &&
    email === known.email &&
    department === (known.department ?? null)
  ) {
    return { kind: 'unchanged' };
  }
  const contact: LocalContact = {
    ...known,
    name,
    nameNorm: normalizeName(name),
    email,
    department,
    updatedAt: now,
  };
  await commitLocal(
    db,
    { upserts: [{ entity: 'contact', row: contact }] },
    { now },
  );
  return { kind: 'saved', contact };
}

/** Takes a contact off the lists; its parcels keep its name (§9.2 purges it later). */
export async function deleteContact(
  db: CourrierDatabase,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<void> {
  const known = await db.contact.get(id);
  if (!known || known.deletedAt) return;
  await commitLocal(
    db,
    {
      upserts: [
        {
          entity: 'contact',
          row: { ...known, deletedAt: now, updatedAt: now },
        },
      ],
    },
    { now },
  );
}

export type MergeOptions = { agentId: string; now?: Date };

/**
 * « Rattacher à … »: a contact who joined the directory becomes that card
 * everywhere. Its parcels name the person (the department typed on each
 * stays), the names learned for it point to the person, and the contact
 * leaves the lists; each parcel's history says its recipient changed. All
 * in one local write, queued for `sync.push`. A contact already merged or
 * deleted writes nothing: the merge is safe to run twice.
 */
export async function mergeContact(
  db: CourrierDatabase,
  contactId: string,
  personId: string,
  { agentId, now = new Date() }: MergeOptions,
): Promise<number> {
  const contact = await db.contact.get(contactId);
  const person = await db.directoryPerson.get(personId);
  if (!contact || contact.deletedAt || !person || !listed(person)) return 0;
  const parcels = (
    await db.parcel.where('contactId').equals(contactId).toArray()
  ).filter((parcel) => !parcel.deletedAt);
  const aliases = (
    await db.recipientAlias.where('contactId').equals(contactId).toArray()
  ).filter((alias) => !alias.deletedAt);
  const options = { agentId, now };
  const upserts: Upsert[] = [
    ...aliases.map((row) => ({
      entity: 'recipient_alias' as const,
      row: { ...row, contactId: null, personId, updatedAt: now },
    })),
    ...parcels.flatMap((row): Upsert[] => [
      {
        entity: 'parcel',
        row: { ...row, contactId: null, personId, updatedAt: now },
      },
      parcelEvent(
        row.id,
        { type: 'parcel.edited', fields: ['recipient'] },
        options,
      ),
    ]),
    { entity: 'contact', row: { ...contact, deletedAt: now, updatedAt: now } },
  ];
  await commitLocal(db, { upserts }, { now });
  return parcels.length;
}
