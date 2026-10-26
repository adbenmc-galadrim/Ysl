import type { RecipientKind } from '@repo/contract/recipient';
import { normalizeName } from '@repo/shared/text';
import type { RecipientOption } from '@repo/ui';
import { directoryEntries, toEntry } from '#/features/directory/people';
import type {
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { initialsOf } from '#/features/settings/initials';

/** A card or a contact, as the two screens of F18 list it, and what choosing it records. */
export type Choice = RecipientOption & { kind: RecipientKind };

export function personOption(person: LocalDirectoryPerson): Choice {
  return { ...toEntry(person), email: person.email, kind: 'person' };
}

export function contactOption(contact: LocalContact): Choice {
  return {
    id: contact.id,
    name: contact.name,
    initials: initialsOf(contact.name),
    detail: contact.email ?? undefined,
    email: contact.email ?? undefined,
    kind: 'contact',
  };
}

/** The option of a card or contact by its id, if it is still listed. */
export function optionOf(
  kind: RecipientKind,
  id: string,
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
): Choice | null {
  if (kind === 'person') {
    const person = people.find((p) => p.id === id);
    return person?.active && !person.deletedAt ? personOption(person) : null;
  }
  const contact = contacts.find((c) => c.id === id);
  return contact && !contact.deletedAt ? contactOption(contact) : null;
}

/** « Choisir le destinataire »: the directory's search, then the contacts whose name matches. */
export function searchOptions(
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  query: string,
): Choice[] {
  const needle = normalizeName(query);
  if (!needle) return [];
  const byId = new Map(people.map((person) => [person.id, person]));
  const cards = directoryEntries(people, query).map((entry) =>
    personOption(byId.get(entry.id)!),
  );
  const others = contacts
    .filter((c) => !c.deletedAt && normalizeName(c.name).includes(needle))
    .map(contactOption);
  return [...cards, ...others];
}

/** The people the last parcels were for, most recent first, each once. */
export function recentOptions(
  parcels: readonly LocalParcel[],
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  limit = 3,
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
    const option = optionOf(kind, id, people, contacts);
    if (option) recents.push(option);
  }
  return recents;
}
