import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import { prepareSignOut } from '#/features/sync/sign-out-guard';
import { openTestDatabase, parcelRow } from './helpers/local-rows';

describe('prepareSignOut', () => {
  it('waits for one last synchronisation even with an empty outbox', async () => {
    const db = await openTestDatabase();
    const syncNow = vi.fn().mockResolvedValue(undefined);

    await expect(prepareSignOut(db, syncNow)).resolves.toEqual({ ok: true });
    expect(syncNow).toHaveBeenCalledOnce();
  });

  it('tries one synchronisation, and lets go once the outbox is empty', async () => {
    const db = await openTestDatabase();
    await commitLocal(db, {
      upserts: [{ entity: 'parcel', row: parcelRow() }],
    });
    const syncNow = vi.fn(async () => {
      await db.outbox.clear();
    });

    await expect(prepareSignOut(db, syncNow)).resolves.toEqual({ ok: true });
    expect(syncNow).toHaveBeenCalledOnce();
  });

  it('blocks and counts what is still queued', async () => {
    const db = await openTestDatabase();
    await commitLocal(db, {
      upserts: [
        { entity: 'parcel', row: parcelRow() },
        { entity: 'parcel', row: parcelRow() },
      ],
    });

    await expect(
      prepareSignOut(db, vi.fn().mockResolvedValue(undefined)),
    ).resolves.toEqual({ ok: false, pending: 2 });
  });

  it('does not hold a sign-out for changes the server refused', async () => {
    const db = await openTestDatabase();
    await commitLocal(db, {
      upserts: [{ entity: 'parcel', row: parcelRow() }],
    });
    await db.outbox.toCollection().modify((op) => {
      op.state = 'rejected';
    });

    await expect(
      prepareSignOut(db, vi.fn().mockResolvedValue(undefined)),
    ).resolves.toEqual({ ok: true });
  });
});
