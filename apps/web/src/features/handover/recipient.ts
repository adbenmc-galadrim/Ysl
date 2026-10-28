import type { RemiseRecipient } from '@repo/ui';
import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
} from '#/features/db/schema';
import { fullName } from '#/features/directory/people';
import type { HandoverRecipient } from '#/features/handover/waiting';
import { outsideDetail } from '#/features/recipient/options';
import { initialsOf } from '#/features/settings/initials';

/** The person as the handover names them, with the first name the screen speaks of. */
export type HandoverPerson = RemiseRecipient & { firstName: string };

/** A card, or a contact told apart by « Hors annuaire ». */
export function describeRecipient(
  row:
    | { kind: 'person'; person: LocalDirectoryPerson }
    | { kind: 'contact'; contact: LocalContact },
): HandoverPerson {
  if (row.kind === 'person') {
    const name = fullName(row.person);
    return {
      name,
      firstName: row.person.firstName || name,
      initials: initialsOf(name),
      department: row.person.department ?? undefined,
    };
  }
  const { contact } = row;
  return {
    name: contact.name,
    firstName: contact.name.trim().split(/\s+/)[0] ?? contact.name,
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
      ? describeRecipient({ kind, person })
      : null;
  }
  const contact = await db.contact.get(id);
  return contact && !contact.deletedAt
    ? describeRecipient({ kind, contact })
    : null;
}
