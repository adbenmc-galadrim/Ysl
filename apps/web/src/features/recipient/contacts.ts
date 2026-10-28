import { newId } from '@repo/shared/id';
import { normalizeName } from '@repo/shared/text';
import { commitLocal } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import { normalizeEmail } from '#/features/directory/people';
import {
  type Choice,
  contactOption,
  personOption,
} from '#/features/recipient/options';

export type ContactOptions = { agentId: string; now?: Date };

/** « Personne hors annuaire » as typed (F27): a name, an e-mail and a department if known. */
export type OutsideContact = {
  name: string;
  email: string;
  department: string;
};

/**
 * Whoever this mailroom already knows under the e-mail typed for someone
 * outside the directory: a card of the directory first, then a contact.
 * The sheet offers them instead of a second contact for the same address.
 */
export function outsideDuplicate(
  email: string,
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
): Choice | null {
  const key = normalizeEmail(email);
  if (!key) return null;
  const person = people.find(
    (p) => p.active && !p.deletedAt && normalizeEmail(p.email) === key,
  );
  if (person) return personOption(person);
  const contact = contacts.find(
    (c) => !c.deletedAt && c.email !== null && normalizeEmail(c.email) === key,
  );
  return contact ? contactOption(contact) : null;
}

/**
 * The contact a hand-typed name stands for: the one this mailroom already
 * typed with that e-mail, or with that name and no e-mail yet, counted once
 * more; a new one otherwise. Typing the same temp twice keeps one card. A
 * department typed replaces the one it had.
 */
export async function typedContact(
  db: CourrierDatabase,
  name: string,
  email: string,
  { agentId, now = new Date() }: ContactOptions,
  department = '',
): Promise<LocalContact> {
  const service = department.trim() || null;
  const key = normalizeEmail(email);
  const nameNorm = normalizeName(name);
  const live = (row: LocalContact) => row.deletedAt === null;
  const known =
    (key
      ? (await db.contact.where('email').equals(key).toArray()).find(live)
      : undefined) ??
    (await db.contact.where('nameNorm').equals(nameNorm).toArray()).find(
      (row) => live(row) && row.email === null,
    );
  if (known) {
    return {
      ...known,
      email: known.email ?? (key || null),
      department: service ?? known.department ?? null,
      updatedAt: now,
      usageCount: known.usageCount + 1,
      lastUsedAt: now,
    };
  }
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: name.trim(),
    nameNorm,
    email: key || null,
    department: service,
    createdBy: agentId,
    usageCount: 1,
    lastUsedAt: now,
  };
}

/**
 * Saves someone typed outside the directory as a contact, local first and
 * queued for `sync.push`, and returns the choice it makes; a card of the
 * directory under the same e-mail is chosen instead, nothing written.
 */
export async function saveOutsideContact(
  db: CourrierDatabase,
  typed: OutsideContact,
  options: ContactOptions,
): Promise<Choice> {
  const now = options.now ?? new Date();
  const key = normalizeEmail(typed.email);
  if (key) {
    const person = (
      await db.directoryPerson.where('email').equals(key).toArray()
    ).find((p) => p.active && !p.deletedAt);
    if (person) return personOption(person);
  }
  const contact = await typedContact(
    db,
    typed.name,
    typed.email,
    { ...options, now },
    typed.department,
  );
  await commitLocal(
    db,
    { upserts: [{ entity: 'contact', row: contact }] },
    { now },
  );
  return contactOption(contact);
}
