import type { RecipientKind } from '@repo/contract/recipient';
import type { Collectee, Collector } from '@repo/ui';
import type { LocalContact, LocalDirectoryPerson } from '#/features/db/schema';
import {
  type Choice,
  contactOption,
  personOption,
  searchOptions,
} from '#/features/recipient/options';
import {
  type HandoverRecipient,
  recipientKey,
} from '#/features/handover/waiting';

/** At most this many names « Sans colis en attente »: the rest is a typo away. */
export const OTHERS_LIMIT = 20;

const toCollectee = (choice: Choice): Collectee => ({
  id: recipientKey(choice),
  name: choice.name,
  initials: choice.initials,
  department: choice.detail ?? '',
});

/** The card or contact behind a row of « Qui retire ses colis ? ». */
export function recipientOfRow(id: string): HandoverRecipient {
  const at = id.indexOf(':');
  return {
    kind: id.slice(0, at) as RecipientKind,
    id: id.slice(at + 1),
  };
}

/**
 * « Qui retire ses colis ? »: whoever matches the name, department or
 * e-mail, accents aside, those with parcels first with how many. With
 * nothing typed, everyone who has something waiting, by name.
 */
export function collectors(
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  counts: ReadonlyMap<string, number>,
  query: string,
): { waiting: Collector[]; others: Collectee[] } {
  const choices = query.trim()
    ? searchOptions(people, contacts, query)
    : [
        ...people.filter((p) => p.active && !p.deletedAt).map(personOption),
        ...contacts.filter((c) => !c.deletedAt).map(contactOption),
      ]
        .filter((choice) => counts.has(recipientKey(choice)))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const waiting: Collector[] = [];
  const others: Collectee[] = [];
  for (const choice of choices) {
    const parcels = counts.get(recipientKey(choice)) ?? 0;
    if (parcels > 0) waiting.push({ person: toCollectee(choice), parcels });
    else if (others.length < OTHERS_LIMIT) others.push(toCollectee(choice));
  }
  return { waiting, others };
}
