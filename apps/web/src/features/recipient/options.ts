import { FREQUENT_USES, type RecipientKind } from '@repo/contract/recipient';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { normalizeName } from '@repo/shared/text';
import type { RecipientOption } from '@repo/ui';
import {
  type DepartmentNames,
  directoryEntries,
  NO_DEPARTMENT_NAMES,
  normalizeEmail,
  toEntry,
} from '#/features/directory/people';
import type {
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { initialsOf } from '#/features/settings/initials';

const t = createTranslator(DEFAULT_LOCALE);

/** A card or a contact, as the two screens of F18 list it, and what choosing it records. */
export type Choice = RecipientOption & { kind: RecipientKind };

/** A card, its department telling it from a twin at the same address (ME23). */
export function personOption(
  person: LocalDirectoryPerson,
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): Choice {
  return { ...toEntry(person, names), email: person.email, kind: 'person' };
}

/** « Hors annuaire », with the department when known: how a contact is told from a card. */
export function outsideDetail(contact: Pick<LocalContact, 'department'>) {
  return contact.department
    ? t('recipient.outside.in', { department: contact.department })
    : t('recipient.outside');
}

export function contactOption(contact: LocalContact): Choice {
  return {
    id: contact.id,
    name: contact.name,
    initials: initialsOf(contact.name),
    detail: outsideDetail(contact),
    email: contact.email ?? undefined,
    kind: 'contact',
  };
}

const lastUse = (contact: LocalContact) => contact.lastUsedAt?.getTime() ?? 0;

/** The option of a card or contact by its id, if it is still listed. */
export function optionOf(
  kind: RecipientKind,
  id: string,
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): Choice | null {
  if (kind === 'person') {
    const person = people.find((p) => p.id === id);
    return person?.active && !person.deletedAt
      ? personOption(person, names)
      : null;
  }
  const contact = contacts.find((c) => c.id === id);
  return contact && !contact.deletedAt ? contactOption(contact) : null;
}

/**
 * « Choisir le destinataire »: the directory and the contacts whose name,
 * department or e-mail matches, accents and case aside, so « lefevre »
 * finds Hugo Lefèvre. The contacts who keep coming back head the list,
 * last used first; everyone else follows in alphabetical order, cards and
 * contacts alike.
 */
export function searchOptions(
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  query: string,
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): Choice[] {
  const needle = normalizeName(query);
  if (!needle) return [];
  const mail = normalizeEmail(query);
  const byId = new Map(people.map((person) => [person.id, person]));
  const cards = directoryEntries(people, query, names).map((entry) => ({
    key: byId.get(entry.id)!.nameNorm,
    choice: personOption(byId.get(entry.id)!, names),
  }));
  const found = contacts.filter(
    (c) =>
      !c.deletedAt &&
      (normalizeName(c.name).includes(needle) ||
        normalizeName(c.department ?? '').includes(needle) ||
        (c.email !== null && c.email.toLowerCase().includes(mail))),
  );
  const frequent = found
    .filter((c) => c.usageCount >= FREQUENT_USES)
    .sort((a, b) => lastUse(b) - lastUse(a) || b.usageCount - a.usageCount)
    .map(contactOption);
  const rest = [
    ...cards,
    ...found
      .filter((c) => c.usageCount < FREQUENT_USES)
      .map((c) => ({ key: c.nameNorm, choice: contactOption(c) })),
  ]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ choice }) => choice);
  return [...frequent, ...rest];
}

/** The people the last parcels were for, most recent first, each once. */
export function recentOptions(
  parcels: readonly LocalParcel[],
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  limit = 3,
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): Choice[] {
  const seen = new Set<string>();
  const recents: Choice[] = [];
  const sorted = [...parcels].sort(
    (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime(),
  );
  for (const parcel of sorted) {
    if (recents.length >= limit) break;
    const [kind, id] = parcel.personId
      ? (['person', parcel.personId] as const)
      : parcel.contactId
        ? (['contact', parcel.contactId] as const)
        : [null, null];
    if (!kind || parcel.deletedAt || seen.has(`${kind}:${id}`)) continue;
    seen.add(`${kind}:${id}`);
    const option = optionOf(kind, id, people, contacts, names);
    if (option) recents.push(option);
  }
  return recents;
}
