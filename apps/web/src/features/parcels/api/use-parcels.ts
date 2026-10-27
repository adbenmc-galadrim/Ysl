import { OPEN_STATUSES } from '@repo/contract/parcel-status';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { Parcel as ParcelRow } from '@repo/ui';
import { Dexie } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import type {
  CourrierDatabase,
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import {
  type RecipientContext,
  startOfDay,
  toParcelRow,
} from '#/features/parcels/model';

const t = createTranslator(DEFAULT_LOCALE);

const byId = <Row extends { id: string }>(rows: (Row | undefined)[]) =>
  new Map(rows.flatMap((row): [string, Row][] => (row ? [[row.id, row]] : [])));

/** The people and contacts these parcels are for, read in two queries. */
export async function loadRecipientContext(
  database: CourrierDatabase,
  parcels: readonly LocalParcel[],
): Promise<RecipientContext> {
  const personIds = [
    ...new Set(parcels.flatMap((parcel) => parcel.personId ?? [])),
  ];
  const contactIds = [
    ...new Set(parcels.flatMap((parcel) => parcel.contactId ?? [])),
  ];
  const [people, contacts] = await Promise.all([
    database.directoryPerson.bulkGet(personIds),
    database.contact.bulkGet(contactIds),
  ]);
  return {
    people: byId<LocalDirectoryPerson>(people),
    contacts: byId<LocalContact>(contacts),
  };
}

/**
 * The parcels the home list shows, oldest first within a status: still on
 * the desk, or handed over today. Reads only the local database.
 */
export async function listHomeParcels(
  database: CourrierDatabase,
  now = new Date(),
): Promise<ParcelRow[]> {
  const [open, delivered] = await Promise.all([
    Promise.all(
      OPEN_STATUSES.map((status) =>
        database.parcel
          .where('[status+receivedAt]')
          .between([status, Dexie.minKey], [status, Dexie.maxKey])
          .toArray(),
      ),
    ),
    database.parcel
      .where('deliveredAt')
      .aboveOrEqual(startOfDay(now))
      .toArray(),
  ]);
  const byReception = (a: LocalParcel, b: LocalParcel) =>
    a.receivedAt.getTime() - b.receivedAt.getTime();
  const parcels: LocalParcel[] = [
    ...open.flat(),
    ...delivered.sort(byReception),
  ];
  const context = await loadRecipientContext(database, parcels);
  return parcels.flatMap(
    (parcel) => toParcelRow(parcel, context, now, t) ?? [],
  );
}

/**
 * The parcels « À compléter » with nobody set for them, by id, with the
 * name read on their label: those Colis offers to « Choisir » for.
 */
export async function listUnaddressed(
  database: CourrierDatabase,
): Promise<Map<string, string | null>> {
  const parcels = await database.parcel
    .where('[status+receivedAt]')
    .between(['a_completer', Dexie.minKey], ['a_completer', Dexie.maxKey])
    .toArray();
  return new Map(
    parcels
      .filter((p) => !p.deletedAt && !p.personId && !p.contactId)
      .map((p) => [p.id, p.readName]),
  );
}

const TICK_MS = 60 * 1000;

/** The time, moved on once a minute so "il y a 2 h" and "aujourd'hui" stay true. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** `undefined` while the first read is on its way, then live rows. */
export function useHomeParcels(): ParcelRow[] | undefined {
  const now = useMinuteClock();
  return useLiveQuery(() => listHomeParcels(db, now), [now]);
}
