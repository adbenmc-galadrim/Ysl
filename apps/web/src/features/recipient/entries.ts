import type { RecipientEntry } from '@repo/contract/recipient';
import type { LocalContact, LocalDirectoryPerson } from '#/features/db/schema';

/**
 * Who a parcel may be for: the active cards of the directory, then the
 * contacts outside it (§4.5, « Annuaire, puis contacts hors annuaire »).
 * A contact has one name: its last word is taken for the last name.
 */
export function recipientEntries(
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
): RecipientEntry[] {
  const cards = people
    .filter((person) => person.active && !person.deletedAt)
    .map((person): RecipientEntry => ({
      id: person.id,
      kind: 'person',
      firstName: person.firstName,
      lastName: person.lastName,
    }));
  const others = contacts
    .filter((contact) => !contact.deletedAt)
    .map((contact): RecipientEntry => {
      const words = contact.name.trim().split(/\s+/);
      const lastName = words.pop() ?? '';
      return {
        id: contact.id,
        kind: 'contact',
        firstName: words.join(' '),
        lastName,
      };
    });
  return [...cards, ...others];
}
