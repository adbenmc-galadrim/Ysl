import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import { countOutbox } from '#/features/sync/outbox-counts';
import { openTestDatabase, parcelRow } from './helpers/local-rows';

describe('countOutbox', () => {
  it('follows the outbox: queued apart from rejected, nothing once sent', async () => {
    const db = await openTestDatabase();
    expect(await countOutbox(db)).toEqual({
      pending: 0,
      rejected: 0,
      oldestAt: null,
    });

    const [first, second, third] = await commitLocal(db, {
      upserts: [
        { entity: 'parcel', row: parcelRow() },
        { entity: 'parcel', row: parcelRow() },
        { entity: 'parcel', row: parcelRow() },
      ],
    });
    expect(await countOutbox(db)).toMatchObject({ pending: 3, rejected: 0 });

    await db.outbox
      .where('opId')
      .equals(second!)
      .modify((op) => {
        op.state = 'rejected';
      });
    await db.outbox.where('opId').equals(third!).delete();
    expect(await countOutbox(db)).toMatchObject({ pending: 1, rejected: 1 });
    expect(await db.outbox.where('opId').equals(first!).count()).toBe(1);
  });

  it('dates the oldest change still waiting, refused or not', async () => {
    const db = await openTestDatabase();
    const [recent, old] = await commitLocal(db, {
      upserts: [
        { entity: 'parcel', row: parcelRow() },
        { entity: 'parcel', row: parcelRow() },
      ],
    });
    const yesterday = new Date(2026, 9, 23, 8, 0);
    await db.outbox
      .where('opId')
      .equals(old!)
      .modify((op) => {
        op.clientTs = yesterday;
        op.state = 'rejected';
      });
    expect((await countOutbox(db)).oldestAt).toEqual(yesterday);

    await db.outbox.where('opId').equals(old!).delete();
    const { oldestAt } = await countOutbox(db);
    expect(oldestAt).toEqual(
      (await db.outbox.where('opId').equals(recent!).first())!.clientTs,
    );
  });
});
