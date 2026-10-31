import type { RemiseRecipient } from '@repo/ui';
import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import {
  departmentLabel,
  departmentNames,
  type DepartmentNames,
  fullName,
  NO_DEPARTMENT_NAMES,
} from '#/features/directory/people';
import type { HandoverRecipient } from '#/features/handover/waiting';
import { outsideDetail } from '#/features/recipient/options';
import { initialsOf } from '#/features/settings/initials';

/** « Marc » for « Marc Petit »: how the screens speak of a contact or a recorded name. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The person as the handover names them, with the first name the screen speaks of. */
export type HandoverPerson = RemiseRecipient & { firstName: string };

/** A card, or a contact told apart by « Hors annuaire ». */
export function describeRecipient(
  row:
    | { kind: 'person'; person: LocalDirectoryPerson }
    | { kind: 'contact'; contact: LocalContact },
  names: DepartmentNames = NO_DEPARTMENT_NAMES,
): HandoverPerson {
  if (row.kind === 'person') {
    const name = fullName(row.person);
    return {
      name,
      firstName: row.person.firstName || name,
      initials: initialsOf(name),
      department: departmentLabel(row.person, names) || undefined,
    };
  }
  const { contact } = row;
  return {
    name: contact.name,
    firstName: firstNameOf(contact.name),
    initials: initialsOf(contact.name),
    department: outsideDetail(contact),
  };
}

/**
 * Who a code or a pick names, or null when the card or contact is gone
 * from this iPhone (deleted, merged).
 */
export async function loadHandoverPerson(
  db: CourrierDatabase,
  { kind, id }: HandoverRecipient,
): Promise<HandoverPerson | null> {
  if (kind === 'person') {
    const person = await db.directoryPerson.get(id);
    return person && !person.deletedAt
      ? describeRecipient({ kind, person }, await departmentNames(db))
      : null;
  }
  const contact = await db.contact.get(id);
  return contact && !contact.deletedAt
    ? describeRecipient({ kind, contact })
    : null;
}
