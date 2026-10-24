import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { listHomeParcels } from '#/features/parcels/api/use-parcels';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const at = (hour: number, dayOffset = 0) =>
  new Date(2026, 9, 24 + dayOffset, hour, 0);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('listHomeParcels', () => {
  it('lists the open parcels and today’s handovers, nothing else', async () => {
    const open = parcelRow({ tracking: 'OPEN' });
    const today = parcelRow({
      status: 'remis',
      tracking: 'TODAY',
      deliveredAt: at(9),
      deliveredBy: 'agent-1',
    });
    await db.parcel.bulkPut([
      open,
      today,
      parcelRow({
        status: 'remis',
        tracking: 'YESTERDAY',
        deliveredAt: at(18, -1),
        deliveredBy: 'agent-1',
      }),
      parcelRow({ status: 'retourne', tracking: 'BACK' }),
      parcelRow({ tracking: 'GONE', deletedAt: NOW }),
    ]);

    const rows = await listHomeParcels(db, NOW);

    expect(rows.map((row) => row.id).sort()).toEqual(
      [open.id, today.id].sort(),
    );
  });

  it('orders every status by reception and names the recipient', async () => {
    const person = personRow();
    await db.directoryPerson.put(person);
    const later = parcelRow({ receivedAt: at(11), personId: person.id });
    const earlier = parcelRow({ receivedAt: at(8) });
    const deliveredLate = parcelRow({
      status: 'remis',
      receivedAt: at(9, -1),
      deliveredAt: at(11),
      deliveredBy: 'agent-1',
    });
    const deliveredEarly = parcelRow({
      status: 'remis',
      receivedAt: at(8, -1),
      deliveredAt: at(11, 0),
      deliveredBy: 'agent-1',
    });
    await db.parcel.bulkPut([later, earlier, deliveredLate, deliveredEarly]);

    const rows = await listHomeParcels(db, NOW);

    expect(rows.map((row) => row.id)).toEqual([
      earlier.id,
      later.id,
      deliveredEarly.id,
      deliveredLate.id,
    ]);
    expect(rows[1]?.recipient).toBe('Camille Morel');
  });
});
