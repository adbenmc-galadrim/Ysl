import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { normalizeName } from '@repo/shared/text';
import type {
  ContactDraft,
  ContactDraftErrors,
  DirectoryEntry,
} from '@repo/ui';
import { commitLocal } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import { initialsOf } from '#/features/settings/initials';

const t = createTranslator(DEFAULT_LOCALE);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An address that can take a message: something, an at sign, a domain with a dot. */
export function isEmail(email: string): boolean {
  return EMAIL.test(email);
}

/** The key the directory is deduplicated on (F50): the e-mail, trimmed, in lower case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function fullName(
  person: Pick<LocalDirectoryPerson, 'firstName' | 'lastName'>,
): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

const listed = (person: LocalDirectoryPerson) =>
  person.active && !person.deletedAt;

export function validatePerson(draft: ContactDraft): ContactDraftErrors {
  const errors: ContactDraftErrors = {};
  if (!draft.firstName.trim())
    errors.firstName = t('directory.error.firstName');
  if (!draft.lastName.trim()) errors.lastName = t('directory.error.lastName');
  const email = normalizeEmail(draft.email);
  if (!email) errors.email = t('directory.error.emailMissing');
  else if (!isEmail(email)) errors.email = t('directory.error.emailInvalid');
  return errors;
}

/**
 * The person the directory lists under this e-mail, whatever its case,
 * other than `exceptId` (the card being edited).
 */
export async function findByEmail(
  db: CourrierDatabase,
  email: string,
  exceptId?: string,
): Promise<LocalDirectoryPerson | undefined> {
  const key = normalizeEmail(email);
  if (!key) return undefined;
  const matches = await db.directoryPerson
    .where('email')
    .equalsIgnoreCase(key)
    .toArray();
  return matches.find(
    (person) =>
      person.id !== exceptId &&
      !person.deletedAt &&
      normalizeEmail(person.email) === key,
  );
}

export type SaveResult =
  | { kind: 'saved'; person: LocalDirectoryPerson }
  | { kind: 'duplicate'; person: LocalDirectoryPerson }
  | { kind: 'invalid'; errors: ContactDraftErrors };

export type SaveOptions = {
  /** The card to update; a new one otherwise. */
  id?: string;
  now?: Date;
};

/**
 * Adds a person to the directory, or updates one, local first and queued for
 * `sync.push`. An e-mail the directory already has never makes a second
 * card: the person already there comes back instead, for the caller to use.
 * The server holds the same rule (`directory_person_email_idx`) for cards
 * added on two iPhone before they synced.
 */
export async function savePerson(
  db: CourrierDatabase,
  draft: ContactDraft,
  { id, now = new Date() }: SaveOptions = {},
): Promise<SaveResult> {
  const errors = validatePerson(draft);
  if (Object.keys(errors).length) return { kind: 'invalid', errors };
  const duplicate = await findByEmail(db, draft.email, id);
  if (duplicate) return { kind: 'duplicate', person: duplicate };

  const existing = id ? await db.directoryPerson.get(id) : undefined;
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  const person: LocalDirectoryPerson = {
    ...(existing ?? {
      id: id ?? newId(),
      createdAt: now,
      deletedAt: null,
      site: null,
      source: 'manuel',
      active: true,
    }),
    updatedAt: now,
    active: true,
    firstName,
    lastName,
    nameNorm: normalizeName(`${firstName} ${lastName}`),
    email: normalizeEmail(draft.email),
    department: draft.department.trim() || null,
  };
  await commitLocal(
    db,
    { upserts: [{ entity: 'directory_person', row: person }] },
    { now },
  );
  return { kind: 'saved', person };
}

/** A new card prefilled from a search that found nobody: an e-mail, or a name. */
export function draftFromQuery(query: string): Partial<ContactDraft> {
  const text = query.trim();
  if (!text) return {};
  if (text.includes('@')) return { email: text };
  const [firstName = '', ...rest] = text.split(/\s+/);
  return rest.length
    ? { firstName, lastName: rest.join(' ') }
    : { lastName: firstName };
}

export function toDraft(person: LocalDirectoryPerson): ContactDraft {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    department: person.department ?? '',
  };
}

export function toEntry(person: LocalDirectoryPerson): DirectoryEntry {
  const name = fullName(person);
  return {
    id: person.id,
    name,
    initials: initialsOf(name),
    detail: person.department ?? person.email,
  };
}

/**
 * The directory as the Annuaire screen lists it: active people only, in
 * alphabetical order of their name, narrowed by a search on the name, the
 * department or the e-mail, accents and case aside.
 */
export function directoryEntries(
  people: readonly LocalDirectoryPerson[],
  query = '',
): DirectoryEntry[] {
  const needle = normalizeName(query);
  const mail = normalizeEmail(query);
  return people
    .filter(listed)
    .filter(
      (person) =>
        !needle ||
        normalizeName(fullName(person)).includes(needle) ||
        normalizeName(person.department ?? '').includes(needle) ||
        (mail !== '' && person.email.toLowerCase().includes(mail)),
    )
    .sort((a, b) => a.nameNorm.localeCompare(b.nameNorm))
    .map(toEntry);
}

/** How many people the directory lists. */
export function directorySize(people: readonly LocalDirectoryPerson[]) {
  return people.filter(listed).length;
}
