import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import {
  departmentNames,
  type DepartmentNames,
} from '#/features/directory/people';

/** What the recipient picker searches: the directory, the contacts, the latest parcels for "Récents". */
export type RecipientBook = {
  people: readonly LocalDirectoryPerson[];
  contacts: readonly LocalContact[];
  latest: readonly LocalParcel[];
  names: DepartmentNames;
};

export async function loadRecipientBook(
  db: CourrierDatabase,
): Promise<RecipientBook> {
  const [people, contacts, latest, names] = await Promise.all([
    db.directoryPerson.toArray(),
    db.contact.toArray(),
    // Ids are UUID v7: their order is the order the parcels came in.
    db.parcel.orderBy(':id').reverse().limit(60).toArray(),
    departmentNames(db),
  ]);
  return { people, contacts, latest, names };
}
