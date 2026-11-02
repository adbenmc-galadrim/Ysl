import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  commonLocation,
  locationsOf,
  postDeposit,
} from '#/features/parcels/deposit';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

let db: CourrierDatabase;
const finance = '00000000-0000-7000-8000-00000000000f';
const legal = '00000000-0000-7000-8000-00000000000a';

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('the places of a department', () => {
  it('offers its own, once each, the last used first', async () => {
    const day = (n: number) => new Date(2026, 9, n);
    await db.parcel.bulkPut([
      parcelRow({
        departmentId: finance,
        location: 'Étagère A',
        updatedAt: day(1),
      }),
      parcelRow({
        departmentId: finance,
        location: 'Casier 3',
        updatedAt: day(3),
      }),
      parcelRow({
        departmentId: finance,
        location: 'étagère a',
        updatedAt: day(2),
      }),
      parcelRow({ departmentId: finance, location: null, updatedAt: day(4) }),
      parcelRow({
        departmentId: legal,
        location: 'Armoire',
        updatedAt: day(5),
      }),
    ]);
    expect(await locationsOf(db, finance)).toEqual(['Casier 3', 'étagère a']);
  });

  it('says where a lot is only when all its parcels agree', () => {
    const at = (location: string | null) => ({ location });
    expect(commonLocation([at('A'), at('A')])).toBe('A');
    expect(commonLocation([at('A'), at('B')])).toBeNull();
    expect(commonLocation([at('A'), at(null)])).toBeNull();
    expect(commonLocation([])).toBeNull();
  });
});

describe('a deposit the shuttle places', () => {
  const post = (parcelIds: string[], location?: string) =>
    postDeposit(db, {
      departmentId: finance,
      parcelIds,
      shuttleId: 'shuttle',
      shuttleName: 'Karim',
      location,
      now: NOW,
    });

  it('writes the place on each parcel, with its line in the history, offline', async () => {
    const row = parcelRow({ status: 'en_route', departmentId: finance });
    await db.parcel.put(row);
    await post([row.id], 'Étagère A');
    expect((await db.parcel.get(row.id))?.location).toBe('Étagère A');
    const events = await db.event.toArray();
    expect(events.map(({ entityId, type }) => [entityId, type])).toEqual([
      [row.id, 'parcel.edited'],
    ]);
  });

  it('touches no parcel when it says nothing', async () => {
    const row = parcelRow({ status: 'en_route', departmentId: finance });
    await db.parcel.put(row);
    await post([row.id]);
    expect(await db.parcel.get(row.id)).toEqual(row);
    expect(await db.event.count()).toBe(0);
  });
});
