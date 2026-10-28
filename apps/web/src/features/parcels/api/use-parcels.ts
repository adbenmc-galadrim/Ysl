import { OPEN_STATUSES } from '@repo/contract/parcel-status';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
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
  type HomeParcel,
  type RecipientContext,
  startOfDay,
  toParcelRow,
} from '#/features/parcels/model';
import { loadReminderDates } from '#/features/parcels/reminders';

import { handoversOf } from '#/features/handover/delivered';

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
  const [people, contacts, handovers] = await Promise.all([
    database.directoryPerson.bulkGet(personIds),
    database.contact.bulkGet(contactIds),
    handoversOf(database, parcels),
  ]);
  return {
    people: byId<LocalDirectoryPerson>(people),
    contacts: byId<LocalContact>(contacts),
    handovers,
  };
}

/**
 * The parcels the home list shows, oldest first within a status: still on
 * the desk, or handed over today. Reads only the local database.
 */
export async function listHomeParcels(
  database: CourrierDatabase,
  now = new Date(),
): Promise<HomeParcel[]> {
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
  const [context, dates] = await Promise.all([
    loadRecipientContext(database, parcels),
    loadReminderDates(database, parcels),
  ]);
  return parcels.flatMap(
    (parcel) => toParcelRow(parcel, context, now, t, dates) ?? [],
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

/**
 * The time, moved on once a minute so "il y a 2 h" and "aujourd'hui" stay
 * true, and as the app comes back to the front: iOS stops the timer in the
 * background, and the reminders due overnight must show at once (F37).
 */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}

/** `undefined` while the first read is on its way, then live rows. */
export function useHomeParcels(): HomeParcel[] | undefined {
  const now = useMinuteClock();
  return useLiveQuery(() => listHomeParcels(db, now), [now]);
}
