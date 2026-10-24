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
  HOME_OPEN_STATUSES,
  startOfDay,
  toParcelRow,
} from '#/features/parcels/model';

const t = createTranslator(DEFAULT_LOCALE);

const byId = <Row extends { id: string }>(rows: (Row | undefined)[]) =>
  new Map(rows.flatMap((row): [string, Row][] => (row ? [[row.id, row]] : [])));

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
      HOME_OPEN_STATUSES.map((status) =>
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
  const context = {
    people: byId<LocalDirectoryPerson>(people),
    contacts: byId<LocalContact>(contacts),
  };
  return parcels.flatMap(
    (parcel) => toParcelRow(parcel, context, now, t) ?? [],
  );
}

const TICK_MS = 60 * 1000;

/** Re-reads once a minute, so "il y a 2 h" and "aujourd'hui" stay true. */
function useMinuteTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return tick;
}

/** `undefined` while the first read is on its way, then live rows. */
export function useHomeParcels(): ParcelRow[] | undefined {
  const tick = useMinuteTick();
  return useLiveQuery(() => listHomeParcels(db), [tick]);
}
