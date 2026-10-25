import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import { listPendingParcels } from '#/features/parcels/api/pending-parcels';
import { contactRow, openTestDatabase, parcelRow } from './helpers/local-rows';

describe('listPendingParcels', () => {
  it('names the parcels whose change waits, refused ones apart', async () => {
    const db = await openTestDatabase();
    const queued = parcelRow();
    const refused = parcelRow();
    const sent = parcelRow();
    const [, refusedOp, , sentOp] = await commitLocal(db, {
      upserts: [
        { entity: 'parcel', row: queued },
        { entity: 'parcel', row: refused },
        { entity: 'parcel', row: refused },
        { entity: 'parcel', row: sent },
        { entity: 'contact', row: contactRow() },
      ],
    });
    await db.outbox
      .where('opId')
      .equals(refusedOp!)
      .modify((op) => {
        op.state = 'rejected';
      });
    await db.outbox.where('opId').equals(sentOp!).delete();

    expect(await listPendingParcels(db)).toEqual(
      new Map([
        [queued.id, 'unsent'],
        [refused.id, 'rejected'],
      ]),
    );
  });
});
