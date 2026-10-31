import type { MoveEffects } from '@repo/contract/directory';
import { OPEN_STATUSES } from '@repo/contract/parcel-status';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { isEmail, normalizeName } from '@repo/shared/text';
import type {
  MoveEffectLine,
  PersonFormErrors,
  PersonFormValue,
} from '@repo/ui';
import { commitLocal } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { initialsOf } from '#/features/settings/initials';

const t = createTranslator(DEFAULT_LOCALE);

export { isEmail };

/** The key a department's directory is deduplicated on (F50): the e-mail, trimmed, in lower case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function fullName(
  person: Pick<LocalDirectoryPerson, 'firstName' | 'lastName'>,
): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

export const listed = (person: LocalDirectoryPerson) =>
  person.active && !person.deletedAt;

/** "Prénom et nom" in one field: the first word, and all the rest. */
export function splitName(name: string): {
  firstName: string;
  lastName: string;
} {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

export function validatePerson(draft: PersonFormValue): PersonFormErrors {
  const errors: PersonFormErrors = {};
  const { firstName, lastName } = splitName(draft.name);
  if (!firstName || !lastName) errors.name = t('directory.error.name');
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

export function keepsAddress(
  person: Pick<LocalDirectoryPerson, 'email'> | undefined,
  email: string,
): boolean {
  return !!person && normalizeEmail(person.email) === normalizeEmail(email);
}

/** The other departments holding this person's address, for the admin who sees them all. */
export function sameAddressElsewhere(
  person: LocalDirectoryPerson,
  people: readonly LocalDirectoryPerson[],
  names: DepartmentNames,
): string[] {
  const key = normalizeEmail(person.email);
  return people
    .filter(
      (other) =>
        other.id !== person.id &&
        !other.deletedAt &&
        normalizeEmail(other.email) === key,
    )
    .map(
      (other) => departmentLabel(other, names) || t('directory.noDepartment'),
    );
}

export type SaveResult =
  | { kind: 'saved'; person: LocalDirectoryPerson }
  | { kind: 'duplicate'; person: LocalDirectoryPerson }
  | { kind: 'invalid'; errors: PersonFormErrors };

export type SaveOptions = {
  /** The card to update; a new one otherwise. */
  id?: string;
  now?: Date;
};

/**
 * Adds a person to the directory, or updates one, local first and queued for
 * `sync.push`. An e-mail this account can see never makes a second card: the
 * person already there comes back instead, for the caller to use. A card that
 * keeps its address is not one: two departments may hold the same, each unable
 * to know (`directory_person_email_idx`, one card per address and department).
 * A department is chosen once, on a new card: after that only `directory.move`
 * changes it.
 */
export async function savePerson(
  db: CourrierDatabase,
  draft: PersonFormValue,
  { id, now = new Date() }: SaveOptions = {},
): Promise<SaveResult> {
  const errors = validatePerson(draft);
  if (Object.keys(errors).length) return { kind: 'invalid', errors };
  const existing = id ? await db.directoryPerson.get(id) : undefined;
  const duplicate = keepsAddress(existing, draft.email)
    ? undefined
    : await findByEmail(db, draft.email, id);
  if (duplicate) return { kind: 'duplicate', person: duplicate };

  const typed = draft.name.trim().replace(/\s+/g, ' ');
  // Untouched, a compound first name stays as it is: splitting would cut it wrongly.
  const { firstName, lastName } =
    existing && typed === fullName(existing) ? existing : splitName(typed);
  const departmentId = draft.departmentId || null;
  const chosen =
    !existing && departmentId
      ? await db.department.get(departmentId)
      : undefined;
  const person: LocalDirectoryPerson = {
    ...(existing ?? {
      id: id ?? newId(),
      createdAt: now,
      deletedAt: null,
      source: 'manuel',
      department: chosen?.name ?? null,
      departmentId,
    }),
    updatedAt: now,
    active: true,
    firstName,
    lastName,
    nameNorm: normalizeName(`${firstName} ${lastName}`),
    email: normalizeEmail(draft.email),
    site: draft.site.trim() || null,
  };
  await commitLocal(
    db,
    { upserts: [{ entity: 'directory_person', row: person }] },
    { now },
  );
  return { kind: 'saved', person };
}

/** A new card prefilled from a search that found nobody: an e-mail, or a name. */
export function draftFromQuery(query: string): Partial<PersonFormValue> {
  const text = query.trim();
  if (!text) return {};
  return text.includes('@') ? { email: text } : { name: text };
}

export function toDraft(person: LocalDirectoryPerson): PersonFormValue {
  return {
    name: fullName(person),
    email: person.email,
    site: person.site ?? '',
    departmentId: person.departmentId ?? '',
  };
}

/** A person as lists show them: the detail is the department, else the e-mail. */
export type DirectoryEntry = {
  id: string;
  name: string;
  initials: string;
  detail?: string;
};

/** Departments by id, for the people who name one. */
export type DepartmentNames = ReadonlyMap<string, string>;

export const NO_DEPARTMENT_NAMES: DepartmentNames = new Map();

export async function departmentNames(
  db: CourrierDatabase,
): Promise<DepartmentNames> {
  const rows = await db.department.toArray();
  return new Map(rows.map((row) => [row.id, row.name]));
}

export function toEntry(
  person: LocalDirectoryPerson,
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): DirectoryEntry {
  const name = fullName(person);
  return {
    id: person.id,
    name,
    initials: initialsOf(name),
    detail: departmentLabel(person, names) || person.email,
  };
}

/** Where a person belongs: their department, or the word they came with until that column goes. */
export function departmentLabel(
  person: Pick<LocalDirectoryPerson, 'department' | 'departmentId'>,
  names: DepartmentNames,
): string {
  const id = person.departmentId;
  return (id ? names.get(id) : undefined) ?? person.department ?? '';
}

export const NO_DEPARTMENT = 'sans';
export const ALL_DEPARTMENTS = 'tous';

/**
 * Who the directory lists: active people, alphabetically, narrowed by a tab
 * (`tous`, `sans`, a department id) and a search on the name, the department
 * or the e-mail, accents and case aside.
 */
export function directoryPeople(
  people: readonly LocalDirectoryPerson[],
  names: DepartmentNames,
  query = '',
  tab = ALL_DEPARTMENTS,
): LocalDirectoryPerson[] {
  const needle = normalizeName(query);
  const mail = normalizeEmail(query);
  return people
    .filter(listed)
    .filter((person) =>
      tab === ALL_DEPARTMENTS
        ? true
        : tab === NO_DEPARTMENT
          ? !person.departmentId
          : person.departmentId === tab,
    )
    .filter(
      (person) =>
        !needle ||
        normalizeName(fullName(person)).includes(needle) ||
        normalizeName(departmentLabel(person, names)).includes(needle) ||
        (mail !== '' && person.email.toLowerCase().includes(mail)),
    )
    .sort((a, b) => a.nameNorm.localeCompare(b.nameNorm));
}

/** The directory as the recipient search lists it: same order, same search. */
export function directoryEntries(
  people: readonly LocalDirectoryPerson[],
  query = '',
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): DirectoryEntry[] {
  return directoryPeople(people, names, query).map((person) =>
    toEntry(person, names),
  );
}

/** The section letter of a name: its first letter, without accent. */
export function letterOf(name: string): string {
  const letter = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(letter) ? letter : '#';
}

/** Those still at the desk, by person: the « Colis en cours » of the table. */
export function openParcelsByPerson(
  parcels: readonly Pick<LocalParcel, 'personId' | 'status' | 'deletedAt'>[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { personId, status, deletedAt } of parcels) {
    if (!personId || deletedAt) continue;
    if (!(OPEN_STATUSES as readonly string[]).includes(status)) continue;
    counts.set(personId, (counts.get(personId) ?? 0) + 1);
  }
  return counts;
}

/** What the record lists about a move, from the server's count (ME21). */
export function moveEffectLines(
  { follows, toSettle }: MoveEffects,
  target: string,
  current: string,
): MoveEffectLine[] {
  const lines: MoveEffectLine[] = [];
  if (follows > 0) {
    lines.push({
      icon: 'truck',
      text:
        follows === 1
          ? t('directory.move.follows.one', { department: target })
          : t('directory.move.follows.many', {
              count: follows,
              department: target,
            }),
    });
  }
  if (toSettle > 0) {
    lines.push({
      icon: 'alert',
      text:
        toSettle === 1
          ? t('directory.move.toSettle.one', { department: current })
          : t('directory.move.toSettle.many', {
              count: toSettle,
              department: current,
            }),
    });
  }
  if (lines.length === 0) {
    lines.push({ icon: 'check', text: t('directory.move.none') });
  }
  return lines;
}
