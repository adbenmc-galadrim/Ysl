import { readParcelEvent } from '@repo/contract/parcel-event';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import type {
  CourrierDatabase,
  LocalDeposit,
  LocalDepartment,
  LocalParcel,
} from '#/features/db/schema';
import { latestFirst } from '#/features/parcels/deposit';
import { goesOnTour } from '#/features/parcels/tour';
import {
  currentTour,
  type TourEntries,
  type TourView,
} from '#/features/parcels/tour-view';

export type TourData = {
  tour: TourView<LocalParcel>;
  departments: ReadonlyMap<string, LocalDepartment>;
  incomplete: LocalParcel[];
  toDispatch: LocalParcel[];
  toSettle: number;
  /** The last deposit whose count left a parcel « À régulariser ». */
  lastGap?: LocalDeposit;
  deposits: LocalDeposit[];
};

/** Older deposits end before any tour still shown: their date of departure changes nothing. */
const ENTRY_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;

/** The day a parcel last went on its way: its history says, when it did not leave at once. */
async function loadEntries(
  database: CourrierDatabase,
  parcels: readonly LocalParcel[],
  now: Date,
): Promise<TourEntries> {
  const sent = parcels.filter(
    (parcel) =>
      (parcel.statusSeq ?? 0) > 0 &&
      (parcel.status === 'en_route' ||
        (parcel.depositedAt &&
          now.getTime() - parcel.depositedAt.getTime() < ENTRY_HORIZON_MS)),
  );
  const entries = new Map<string, Date>();
  await Promise.all(
    sent.map(async ({ id }) => {
      const events = await database.event
        .where('[entity+entityId]')
        .equals(['parcel', id])
        .toArray();
      for (const row of events) {
        const event = readParcelEvent(row.type, row.detail);
        if (event?.type !== 'parcel.status' || event.to !== 'en_route')
          continue;
        const seen = entries.get(id);
        if (!seen || seen < row.at) entries.set(id, row.at);
      }
    }),
  );
  return entries;
}

/** Everything on the iPhone: the tour reads the same off the network. */
export async function loadTour(
  database: CourrierDatabase,
  now = new Date(),
): Promise<TourData> {
  const [parcels, departments, deposits] = await Promise.all([
    database.parcel.filter((row) => !row.deletedAt).toArray(),
    database.department.toArray(),
    database.deposit.filter((row) => !row.deletedAt).toArray(),
  ]);
  const settling = new Set(
    parcels
      .filter(({ status }) => status === 'a_regulariser')
      .map(({ id }) => id),
  );
  return {
    deposits,
    lastGap: latestFirst(deposits).find((row) =>
      row.gapParcelIds?.some((id) => settling.has(id)),
    ),
    tour: currentTour(parcels, now, await loadEntries(database, parcels, now)),
    departments: new Map(departments.map((row) => [row.id, row])),
    incomplete: parcels.filter(({ status }) => status === 'a_completer'),
    toDispatch: parcels.filter(({ status }) => status === 'recu'),
    toSettle: parcels.filter(({ status }) => status === 'a_regulariser').length,
  };
}

export const useTour = () => useLiveQuery(() => loadTour(db), []);

/** Whether the company runs tours, once read from this iPhone. */
export const useGoesOnTour = () => useLiveQuery(() => goesOnTour(db), []);
