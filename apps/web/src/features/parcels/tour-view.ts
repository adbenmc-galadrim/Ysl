import type { LocalParcel } from '#/features/db/schema';
import { startOfDay } from '#/features/parcels/model';

type TourParcel = Pick<
  LocalParcel,
  'id' | 'status' | 'departmentId' | 'receivedAt' | 'depositedAt' | 'deletedAt'
>;

/** When each parcel last went on its way, where it differs from its reception. */
export type TourEntries = ReadonlyMap<string, Date>;

export type TourStop<Row> = { departmentId: string; parcels: Row[] };

export type TourDone = {
  departmentId: string;
  count: number;
  confirmedAt: Date;
};

export type TourView<Row> = {
  stops: TourStop<Row>[];
  done: TourDone[];
  /** Departments with nothing left to deposit, out of those of the tour. */
  served: number;
  departments: number;
  left: number;
  deposited: number;
  /** Every parcel of the tour is deposited (§3.7.9). */
  closed: boolean;
};

/** Carried: on its way. A gap (« À régulariser ») or a return leaves the tour: neither holds it open. */
const onItsWay = (parcel: TourParcel) => parcel.status === 'en_route';
const wasDeposited = (parcel: TourParcel) =>
  Boolean(parcel.depositedAt) &&
  parcel.status !== 'a_regulariser' &&
  parcel.status !== 'en_route';

/**
 * The tour of a shuttle, read from its parcels: nothing else to keep in step,
 * on or off the network. Parcels whose time with the shuttle overlaps form one
 * tour; the last one is the current one, and it closes by itself when its last
 * parcel is deposited. A closed tour shows until the day ends.
 */
export function currentTour<Row extends TourParcel>(
  parcels: readonly Row[],
  now: Date,
  entries: TourEntries = new Map(),
): TourView<Row> {
  const spans = parcels
    .filter((row) => !row.deletedAt && (onItsWay(row) || wasDeposited(row)))
    .map((row) => ({
      row,
      from: entries.get(row.id) ?? row.receivedAt,
      to: onItsWay(row) ? Infinity : (row.depositedAt as Date).getTime(),
    }))
    .sort((a, b) => a.from.getTime() - b.from.getTime());

  let tour: typeof spans = [];
  let end = -Infinity;
  for (const span of spans) {
    if (span.from.getTime() > end) tour = [];
    tour.push(span);
    end = Math.max(end, span.to);
  }

  const carried = tour.filter(({ row }) => onItsWay(row)).map(({ row }) => row);
  const put = tour.filter(({ row }) => !onItsWay(row)).map(({ row }) => row);
  const closed = carried.length === 0 && put.length > 0;
  if (closed && end < startOfDay(now).getTime()) {
    return {
      stops: [],
      done: [],
      served: 0,
      departments: 0,
      left: 0,
      deposited: 0,
      closed: false,
    };
  }

  const stops = new Map<string, Row[]>();
  for (const row of carried) {
    const id = row.departmentId ?? '';
    stops.set(id, [...(stops.get(id) ?? []), row]);
  }
  const done = new Map<string, TourDone>();
  for (const row of put) {
    const id = row.departmentId ?? '';
    const at = row.depositedAt as Date;
    const seen = done.get(id);
    done.set(id, {
      departmentId: id,
      count: (seen?.count ?? 0) + 1,
      confirmedAt: seen && seen.confirmedAt > at ? seen.confirmedAt : at,
    });
  }
  const departments = new Set([...stops.keys(), ...done.keys()]).size;
  return {
    stops: [...stops].map(([departmentId, rows]) => ({
      departmentId,
      parcels: rows,
    })),
    done: [...done.values()],
    served: departments - stops.size,
    departments,
    left: carried.length,
    deposited: put.length,
    closed,
  };
}
