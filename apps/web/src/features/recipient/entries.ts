import type { RecipientEntry } from '@repo/contract/recipient';
import type { LocalContact, LocalDirectoryPerson } from '#/features/db/schema';
import {
  departmentLabel,
  type DepartmentNames,
  NO_DEPARTMENT_NAMES,
} from '#/features/directory/people';

/**
 * Who a parcel may be for: the active cards of the directory, then the
 * contacts outside it (§4.5, « Annuaire, puis contacts hors annuaire »).
 * A contact has one name: its last word is taken for the last name. A card
 * carries its department: the id and name once converted, before that the
 * word it came with, or nothing.
 */
export function recipientEntries(
  people: readonly LocalDirectoryPerson[],
  contacts: readonly LocalContact[],
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): RecipientEntry[] {
  const cards = people
    .filter((person) => person.active && !person.deletedAt)
    .map((person): RecipientEntry => {
      const department = departmentLabel(person, names);
      return {
        id: person.id,
        kind: 'person',
        firstName: person.firstName,
        lastName: person.lastName,
        ...(person.departmentId ? { departmentId: person.departmentId } : {}),
        ...(department ? { department } : {}),
      };
    });
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
        uses: contact.usageCount,
      };
    });
  return [...cards, ...others];
}
