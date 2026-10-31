import { statusPatch } from '@repo/contract/parcel-status';
import { normalizeName } from '@repo/shared/text';
import type { Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  DraftParcel,
  LocalContact,
  LocalDepartment,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { parcelEvent } from '#/features/parcels/events';
import { readKeptProfile } from '#/features/settings/operating-profile';

/**
 * Whether a parcel received leaves on a tour (§3.7.6). Only for a profile that
 * says so: a shuttle acting as department skips it (§8.3), and a device without
 * the profile keeps the path it always had.
 */
export async function goesOnTour(db: CourrierDatabase): Promise<boolean> {
  const profile = await readKeptProfile(db);
  return profile !== null && !profile.shuttleActsAsDepartment;
}

type DepartmentSources = {
  chosen?: string | null;
  person?: Pick<LocalDirectoryPerson, 'departmentId'>;
  /** The word kept with a contact, or typed with someone outside the directory. */
  word?: string | null;
};

/** Where a parcel goes: what the agent chose, the recipient's department, the one its word names. An archived one takes no parcel. */
export function departmentOf(
  { chosen, person, word }: DepartmentSources,
  departments: readonly LocalDepartment[],
): string | null {
  const open = departments.filter((department) => !department.deletedAt);
  const named = word
    ? open.find(({ name }) => normalizeName(name) === normalizeName(word))?.id
    : undefined;
  return (
    [chosen, person?.departmentId, named].find(
      (id) => id && open.some((department) => department.id === id),
    ) ?? null
  );
}

/** Where a draft goes, as the review shows it and « Enregistrer » writes it. */
export function draftDepartment(
  draft: DraftParcel,
  people: ReadonlyMap<string, LocalDirectoryPerson>,
  contacts: ReadonlyMap<string, Pick<LocalContact, 'department'>>,
  departments: readonly LocalDepartment[],
): string | null {
  const { recipient } = draft;
  return departmentOf(
    {
      chosen: draft.departmentId,
      person:
        recipient?.kind === 'person' ? people.get(recipient.id) : undefined,
      word:
        draft.department ??
        (recipient?.kind === 'contact'
          ? contacts.get(recipient.id)?.department
          : null),
    },
    departments,
  );
}

/**
 * Where a parcel being completed goes: `undefined` without a tour, `null` with
 * nowhere to go. Another recipient set takes their department, as the server does.
 */
export async function tourDepartment(
  db: CourrierDatabase,
  parcel: Pick<LocalParcel, 'personId' | 'contactId'>,
  edited: LocalParcel,
): Promise<string | null | undefined> {
  if (!(await goesOnTour(db))) return undefined;
  const person = edited.personId
    ? await db.directoryPerson.get(edited.personId)
    : undefined;
  const contact = edited.contactId
    ? await db.contact.get(edited.contactId)
    : undefined;
  const sameRecipient =
    parcel.personId === edited.personId &&
    parcel.contactId === edited.contactId;
  return departmentOf(
    {
      chosen: sameRecipient ? edited.departmentId : null,
      person,
      word: edited.department ?? contact?.department,
    },
    await db.department.toArray(),
  );
}

/** The step after « Reçu »: the trigger judges one change at a time, so it is a write of its own. */
export function onTourWrites(
  row: LocalParcel,
  options: { agentId: string; now: Date },
): Upsert[] {
  return [
    {
      entity: 'parcel',
      row: { ...row, ...statusPatch(row, 'en_route', options) },
    },
    parcelEvent(
      row.id,
      { type: 'parcel.status', from: 'recu', to: 'en_route' },
      options,
    ),
  ];
}
