import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import { CourrierDatabase, type LocalParcel } from '#/features/db/schema';
import { listHomeParcels } from '#/features/parcels/api/use-parcels';

const NOW = new Date(2026, 9, 24, 12, 0);
const at = (hour: number, dayOffset = 0) =>
  new Date(2026, 9, 24 + dayOffset, hour, 0);

function parcel(overrides: Partial<LocalParcel> = {}): LocalParcel {
  return {
    id: newId(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    batchId: null,
    type: 'colis',
    status: 'recu',
    carrier: 'UPS',
    tracking: '1Z0001',
    trackingNorm: '1Z0001',
    personId: null,
    contactId: null,
    readName: null,
    notificationEmail: null,
    department: null,
    senderId: null,
    senderName: null,
    pieceN: null,
    pieceTotal: null,
    weightKg: null,
    carrierService: null,
    reference: null,
    location: null,
    notes: null,
    receivedAt: at(10),
    receivedBy: 'agent-1',
    validatedAt: null,
    notifiedAt: null,
    lastNotifiedAt: null,
    deliveredAt: null,
    deliveredBy: null,
    ...overrides,
  };
}

let db: CourrierDatabase;

beforeEach(async () => {
  db = new CourrierDatabase(`home-test-${newId()}`);
  await db.open();
});

describe('listHomeParcels', () => {
  it('lists the open parcels and today’s handovers, nothing else', async () => {
    const open = parcel({ tracking: 'OPEN' });
    const today = parcel({
      status: 'remis',
      tracking: 'TODAY',
      deliveredAt: at(9),
      deliveredBy: 'agent-1',
    });
    await db.parcel.bulkPut([
      open,
      today,
      parcel({
        status: 'remis',
        tracking: 'YESTERDAY',
        deliveredAt: at(18, -1),
        deliveredBy: 'agent-1',
      }),
      parcel({ status: 'retourne', tracking: 'BACK' }),
      parcel({ tracking: 'GONE', deletedAt: NOW }),
    ]);

    const rows = await listHomeParcels(db, NOW);

    expect(rows.map((row) => row.id).sort()).toEqual(
      [open.id, today.id].sort(),
    );
  });

  it('orders a status by reception and names the recipient', async () => {
    const personId = newId();
    await db.directoryPerson.put({
      id: personId,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      lastName: 'Morel',
      firstName: 'Camille',
      nameNorm: 'camille morel',
      email: 'camille@example.com',
      department: 'Studio',
      site: null,
      source: 'manuel',
      active: true,
    });
    const later = parcel({ receivedAt: at(11), personId });
    const earlier = parcel({ receivedAt: at(8) });
    await db.parcel.bulkPut([later, earlier]);

    const rows = await listHomeParcels(db, NOW);

    expect(rows.map((row) => row.id)).toEqual([earlier.id, later.id]);
    expect(rows[1]?.recipient).toBe('Camille Morel');
  });
});
