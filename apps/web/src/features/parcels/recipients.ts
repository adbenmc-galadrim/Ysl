import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';

/** What the recipient picker searches: the directory, the contacts, the latest parcels for "Récents". */
export type RecipientBook = {
  people: LocalDirectoryPerson[];
  contacts: LocalContact[];
  latest: LocalParcel[];
};

export async function loadRecipientBook(
  db: CourrierDatabase,
): Promise<RecipientBook> {
  const [people, contacts, latest] = await Promise.all([
    db.directoryPerson.toArray(),
    db.contact.toArray(),
    // Ids are UUID v7: their order is the order the parcels came in.
    db.parcel.orderBy(':id').reverse().limit(60).toArray(),
  ]);
  return { people, contacts, latest };
}
