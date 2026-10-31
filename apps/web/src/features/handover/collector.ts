import type { Collectee } from '@repo/ui';
import type {
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import {
  type DepartmentNames,
  fullName,
  NO_DEPARTMENT_NAMES,
} from '#/features/directory/people';
import { OTHERS_LIMIT, toCollectee } from '#/features/handover/collectors';
import {
  type Choice,
  contactOption,
  personOption,
  searchOptions,
} from '#/features/recipient/options';
import { delegateName } from '#/features/replies/record';
import { initialsOf } from '#/features/settings/initials';
import { normalizeName } from '@repo/shared/text';

/** Two spellings of one name, by the key the directory stores (`name_norm`). */
export const sameName = (a: string, b: string) =>
  normalizeName(a) === normalizeName(b);

/**
 * Who collected, as the handover keeps it: the name as typed or picked, one
 * space between words; nobody when it is the recipient themselves.
 */
export function collectorName(
  value: string | null | undefined,
  recipientName: string,
): string | null {
  const name = delegateName(value ?? '');
  // Punctuation alone names nobody.
  return normalizeName(name) && !sameName(name, recipientName) ? name : null;
}

/** Who collects as the screens show them: a card, a contact, or a name as typed. */
export type CollectorCard = {
  name: string;
  initials: string;
  department?: string;
};

/** The colleague the recipient said would come (YSL-70), on the latest reply among their parcels. */
export function announcedCollector(
  parcels: readonly LocalParcel[],
): { name: string; at: Date | null } | null {
  const announced = parcels
    .filter((parcel) => parcel.status === 'notifie' && parcel.expectedDelegate)
    .sort(
      (a, b) => (b.repliedAt?.getTime() ?? 0) - (a.repliedAt?.getTime() ?? 0),
    )[0];
  return announced?.expectedDelegate
    ? { name: announced.expectedDelegate, at: announced.repliedAt }
    : null;
}

export const choiceCard = (choice: Choice): CollectorCard => ({
  name: choice.name,
  initials: choice.initials,
  ...(choice.detail ? { department: choice.detail } : {}),
});

/** A name said or typed, with the department of the card or contact that bears it. */
export function collectorCard(
  name: string,
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): CollectorCard {
  const named = people.filter(
    (p) => p.active && !p.deletedAt && sameName(fullName(p), name),
  );
  // Two cards of this name: nothing says which department is the right one.
  if (named.length > 1) return { name, initials: initialsOf(name) };
  if (named[0]) return choiceCard(personOption(named[0], names));
  const contact = contacts.find((c) => !c.deletedAt && sameName(c.name, name));
  if (contact) return choiceCard(contactOption(contact));
  return { name, initials: initialsOf(name) };
}

/** « Qui retire pour Nora Haddad ? »: anyone of the directory or a contact, accents aside. */
export function collectorChoices(
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  query: string,
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): { choices: Choice[]; listed: Collectee[] } {
  const choices = query.trim()
    ? searchOptions(people, contacts, query, names).slice(0, OTHERS_LIMIT)
    : [];
  return { choices, listed: choices.map(toCollectee) };
}
