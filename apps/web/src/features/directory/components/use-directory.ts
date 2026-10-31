import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '#/features/db/database';
import type {
  LocalContact,
  LocalDepartment,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { openParcelsByPerson } from '#/features/directory/people';

const NO_PEOPLE: LocalDirectoryPerson[] = [];
const NO_CONTACTS: LocalContact[] = [];
const NO_DEPARTMENTS: LocalDepartment[] = [];
const NO_PARCELS: LocalParcel[] = [];

/** What the device holds of the directory; the synchro has limited it to what this account reaches. */
export function useDirectory() {
  const people = useLiveQuery(
    () => db.directoryPerson.toArray(),
    [],
    NO_PEOPLE,
  );
  const contacts = useLiveQuery(() => db.contact.toArray(), [], NO_CONTACTS);
  const departments = useLiveQuery(
    () =>
      db.department
        .orderBy('name')
        .filter((row) => !row.deletedAt)
        .toArray(),
    [],
    NO_DEPARTMENTS,
  );
  const parcels = useLiveQuery(() => db.parcel.toArray(), [], NO_PARCELS);
  const names = useMemo(
    () => new Map(departments.map((row) => [row.id, row.name])),
    [departments],
  );
  const open = useMemo(() => openParcelsByPerson(parcels), [parcels]);
  return { people, contacts, departments, parcels, names, open };
}

export type Directory = ReturnType<typeof useDirectory>;
