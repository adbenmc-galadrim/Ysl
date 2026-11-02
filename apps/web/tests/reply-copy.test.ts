import 'fake-indexeddb/auto';
import { pickupPinHash, pickupTokenHash } from '@repo/contract/pickup';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  copyDraft,
  parcelsOfOneCode,
  recordPhoneCopy,
  sendServerCopy,
} from '#/features/replies/copy';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const nora = personRow({ firstName: 'Nora', lastName: 'Haddad' });
const to = { name: 'Paul Mercier', address: 'paul@example.test' };
const agent = { name: 'Karim', email: 'karim@example.test' };

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
  await db.directoryPerson.put(nora);
});

async function openCode(pin: string) {
  await db.pickupCode.put({
    id: newId(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    personId: nora.id,
    contactId: null,
    departmentId: nora.departmentId ?? null,
    tokenHash: await pickupTokenHash(`YSL:RETRAIT:${pin}`),
    pinHash: await pickupPinHash(pin),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    usedAt: null,
  });
}

const told = () =>
  parcelRow({ personId: nora.id, status: 'notifie', notifiedAt: NOW });

describe('the copy by the mail app', () => {
  it('quotes the code the recipient holds and writes none', async () => {
    await openCode('4821');
    const before = await db.pickupCode.toArray();

    const message = await copyDraft(db, [told()], to, agent, NOW);

    expect(message?.to).toEqual([to.address]);
    expect(message?.body).toContain('4821');
    expect(message?.body).toContain('Copie pour Paul Mercier');
    expect(await db.pickupCode.toArray()).toEqual(before);
  });

  it('gives no mail when no code is open, rather than a new code', async () => {
    expect(await copyDraft(db, [told()], to, agent, NOW)).toBeNull();
    expect(await db.pickupCode.count()).toBe(0);
  });

  it('leaves a line in the history of each parcel', async () => {
    const parcel = told();
    await recordPhoneCopy(db, [parcel], to.name, {
      agentId: 'agent-1',
      now: NOW,
    });
    const events = (await db.event.toArray()).filter(
      (row) => row.entityId === parcel.id,
    );
    expect(events.map((row) => row.type)).toEqual(['parcel.copied']);
  });
});

describe('parcelsOfOneCode', () => {
  it('leaves out the parcels of another department', () => {
    const here = { ...told(), departmentId: 'finance' };
    const also = { ...told(), departmentId: 'finance' };
    const there = { ...told(), departmentId: 'studio' };
    expect(parcelsOfOneCode([here, there, also])).toEqual([here, also]);
  });
});

describe('the copy by the server', () => {
  it('asks for these parcels and this address, and has nothing to say once it left', async () => {
    const parcel = told();
    const send = vi.fn(() => Promise.resolve({ status: 'qr' as const }));

    expect(await sendServerCopy(send, [parcel], to)).toBeNull();
    expect(send).toHaveBeenCalledWith({
      parcelIds: [parcel.id],
      address: to.address,
      name: to.name,
    });
  });

  it.each([
    ['noCode', 'reply.copy.noCode'],
    ['unsubscribed', 'reply.copy.unsubscribed'],
    ['notFound', 'reply.copy.notFound'],
    ['off', 'reply.copy.failed'],
  ] as const)('tells the agent when the answer is %s', async (status, key) => {
    expect(
      await sendServerCopy(() => Promise.resolve({ status }), [told()], to),
    ).toBe(key);
  });

  it('tells the agent when the network fails', async () => {
    expect(
      await sendServerCopy(
        () => Promise.reject(new Error('offline')),
        [told()],
        to,
      ),
    ).toBe('reply.copy.failed');
  });
});
