import { noticeRuleOf, type NoticeRule } from '@repo/contract/mail';
import { OPERATING_PROFILE_KEY } from '@repo/contract/operating-profile';
import { statusPatch } from '@repo/contract/parcel-status';
import { normalizeName } from '@repo/shared/text';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  DraftParcel,
  LocalContact,
  LocalDepartment,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import { parcelEvent } from '#/features/parcels/events';

/**
 * Whether a parcel received leaves on a tour (§3.7.6). Only for a profile that
 * says so: a shuttle acting as department skips it (§8.3), and a device without
 * the profile, or with one it cannot read, keeps the path it always had. Read
 * raw: `parseOperatingProfile` makes a default of what it cannot read, and the
 * default has no shuttle acting as department.
 */
export async function goesOnTour(db: CourrierDatabase): Promise<boolean> {
  return (await noticeRule(db)).tour;
}

/** When this company tells the employee (ME29), read raw for the same reason. */
export async function noticeRule(db: CourrierDatabase): Promise<NoticeRule> {
  const rows = await db.setting
    .where('key')
    .equals(OPERATING_PROFILE_KEY)
    .toArray();
  return noticeRuleOf(rows.find((row) => !row.deletedAt)?.value);
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

/**
 * « Mettre en route » (D31): a parcel received before the profile had tours, or
 * whose tour was cancelled. Without a department it goes back to « À compléter »,
 * which asks for one (ME25). Offline like every write. Says what became of them.
 */
export async function putOnTour(
  db: CourrierDatabase,
  parcelIds: readonly string[],
  { agentId, now = new Date() }: { agentId: string; now?: Date },
): Promise<{ onRoute: number; toComplete: number }> {
  const parcels = await db.parcel.bulkGet([...parcelIds]);
  const options = { agentId, now };
  const upserts: Upsert[] = [];
  let onRoute = 0;
  let toComplete = 0;
  for (const parcel of parcels) {
    if (!parcel || parcel.deletedAt || parcel.status !== 'recu') continue;
    const goesTo = await tourDepartment(db, parcel, parcel);
    if (goesTo === undefined) continue;
    if (goesTo) {
      onRoute += 1;
      upserts.push(
        ...onTourWrites({ ...parcel, departmentId: goesTo }, options),
      );
    } else {
      toComplete += 1;
      upserts.push(
        {
          entity: 'parcel',
          row: { ...parcel, ...statusPatch(parcel, 'a_completer', options) },
        },
        parcelEvent(
          parcel.id,
          { type: 'parcel.status', from: 'recu', to: 'a_completer' },
          options,
        ),
      );
    }
  }
  await commitLocal(db, { upserts }, { now });
  return { onRoute, toComplete };
}
