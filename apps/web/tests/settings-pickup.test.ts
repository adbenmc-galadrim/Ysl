import 'fake-indexeddb/auto';
import { EMPTY_PICKUP } from '@repo/contract/settings';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { readPickup, savePickup } from '#/features/settings/pickup';
import { NOW, openTestDatabase } from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const pickup = {
  ...EMPTY_PICKUP,
  place: '  Rez-de-chaussée, comptoir courrier ',
  hours: { ...EMPTY_PICKUP.hours, mon: ' 9:00–12:30 ' },
};

describe('savePickup', () => {
  it('saves the pickup tidied, queued for the server', async () => {
    expect(await savePickup(db, pickup, { userId: 'admin-1', now: NOW })).toBe(
      'saved',
    );

    expect(await readPickup(db)).toEqual({
      ...EMPTY_PICKUP,
      place: 'Rez-de-chaussée, comptoir courrier',
      hours: { ...EMPTY_PICKUP.hours, mon: '9:00–12:30' },
    });
    const [row] = await db.setting.toArray();
    expect(row).toMatchObject({ key: 'pickup', updatedBy: 'admin-1' });
    expect(await db.outbox.toArray()).toMatchObject([
      { entity: 'setting', entityId: row?.id, type: 'upsert' },
    ]);
  });

  it('keeps the same row from one save to the next', async () => {
    await savePickup(db, pickup, { userId: 'admin-1', now: NOW });
    await savePickup(
      db,
      { ...pickup, instructions: 'Badge obligatoire.' },
      { userId: 'admin-2', now: NOW },
    );

    const rows = await db.setting.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ updatedBy: 'admin-2' });
    const ops = await db.outbox.toArray();
    expect(new Set(ops.map((op) => op.entityId))).toEqual(
      new Set([rows[0]?.id]),
    );
  });

  it('saves to the row the server kept when another iPhone created one too', async () => {
    await savePickup(db, pickup, { userId: 'admin-1', now: NOW });
    const [refused] = await db.setting.toArray();
    const kept = {
      ...refused!,
      id: 'server-row',
      createdAt: new Date(NOW.getTime() + 60_000),
      serverXid: 42,
      value: { ...EMPTY_PICKUP, place: 'Accueil' },
    };
    await db.setting.put(kept);

    expect((await readPickup(db)).place).toBe('Accueil');
    await savePickup(
      db,
      { ...EMPTY_PICKUP, place: 'Accueil, porte B' },
      { userId: 'admin-1', now: NOW },
    );
    expect((await db.outbox.toArray()).at(-1)).toMatchObject({
      entityId: 'server-row',
    });
  });

  it('writes nothing when the screen is left as it was found', async () => {
    expect(
      await savePickup(db, EMPTY_PICKUP, { userId: 'admin-1', now: NOW }),
    ).toBe('unchanged');
    await savePickup(db, pickup, { userId: 'admin-1', now: NOW });
    expect(
      await savePickup(db, await readPickup(db), { userId: 'admin-1' }),
    ).toBe('unchanged');

    expect(await db.outbox.count()).toBe(1);
  });
});
