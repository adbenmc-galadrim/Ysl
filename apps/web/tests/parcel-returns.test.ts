import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalPickupCode } from '#/features/db/schema';
import { homeCounts } from '#/features/shell/home-counts';
import { homeState } from '#/features/parcels/model';
import { moveReturns, returnParcel } from '#/features/parcels/returns';
import { currentTour } from '#/features/parcels/tour-view';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const context = { agentId: 'agent-1', now: NOW };

let db: CourrierDatabase;

const code = (personId: string): LocalPickupCode =>
  ({
    id: `code-${personId}`,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    personId,
    contactId: null,
    departmentId: 'finance',
    usedAt: null,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
  }) as LocalPickupCode;

const shelved = (personId: string) =>
  parcelRow({
    personId,
    status: 'notifie',
    departmentId: 'finance',
    notifiedAt: NOW,
    lastNotifiedAt: NOW,
    depositedAt: NOW,
  });

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('a return', () => {
  it('leaves at once without a shuttle: Petit site has no leg back', async () => {
    const parcel = parcelRow({ status: 'recu', personId: 'p' });
    await db.parcel.put(parcel);
    await returnParcel(db, parcel.id, 'refused', false, context);
    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'retourne',
      returnReason: 'refused',
    });
  });

  it('waits for the shuttle at a department with tours, then reaches the sender', async () => {
    const parcel = shelved('p');
    await db.parcel.put(parcel);
    await returnParcel(db, parcel.id, 'unclaimed', true, context);
    expect((await db.parcel.get(parcel.id))?.status).toBe('retour_prepare');
    await moveReturns(db, [parcel.id], 'retour_en_route', context);
    await moveReturns(db, [parcel.id], 'retourne', context);
    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'retourne',
      returnReason: 'unclaimed',
    });
  });

  it('leaves at once for a parcel the shuttle still holds, tours or not', async () => {
    const parcel = parcelRow({ status: 'recu', personId: 'p' });
    await db.parcel.put(parcel);
    await returnParcel(db, parcel.id, 'address', true, context);
    expect((await db.parcel.get(parcel.id))?.status).toBe('retourne');
  });

  it('closes the code once nothing else waits for the person', async () => {
    const [first, second] = [shelved('p'), shelved('p')];
    await db.parcel.bulkPut([first, second]);
    await db.pickupCode.put(code('p'));
    await returnParcel(db, first.id, 'unclaimed', true, context);
    expect((await db.pickupCode.get('code-p'))?.deletedAt).toBeNull();
    await returnParcel(db, second.id, 'unclaimed', true, context);
    expect((await db.pickupCode.get('code-p'))?.deletedAt).toEqual(NOW);
  });

  it('is neither counted nor reminded, and leaves the tour alone', async () => {
    const parcel = shelved('p');
    await db.parcel.put(parcel);
    await returnParcel(db, parcel.id, 'unclaimed', true, context);
    const row = await db.parcel.get(parcel.id);
    expect(homeCounts([row!], true)).toEqual({
      coming: 0,
      present: 0,
      toSettle: 0,
    });
    expect(homeState(row!, NOW, undefined, true)).toBe('returning');
    expect(currentTour([row!], NOW).left).toBe(0);
  });

  it('forgets its reason when undone', async () => {
    const parcel = shelved('p');
    await db.parcel.put(parcel);
    await returnParcel(db, parcel.id, 'unclaimed', true, context);
    const { changeParcelStatus } = await import('#/features/parcels/status');
    await changeParcelStatus(db, parcel.id, 'notifie', context);
    expect((await db.parcel.get(parcel.id))?.returnReason).toBeNull();
  });
});
