import 'fake-indexeddb/auto';
import { StatusTransitionError } from '@repo/contract/parcel-status';
import { beforeEach, describe, expect, it } from 'vitest';
import { MissingRowError } from '#/features/db/commit';
import type { CourrierDatabase } from '#/features/db/schema';
import { changeParcelStatus, stepBackParcel } from '#/features/parcels/status';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const options = { agentId: 'agent-1', now: NOW };

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('changeParcelStatus', () => {
  it('writes the status and queues it with the counter moved up', async () => {
    const row = parcelRow({ statusSeq: 2 });
    await db.parcel.put(row);

    const opId = await changeParcelStatus(db, row.id, 'notifie', options);

    expect(await db.parcel.get(row.id)).toMatchObject({
      status: 'notifie',
      statusSeq: 3,
      notifiedAt: NOW,
      updatedAt: NOW,
    });
    const [op, event] = await db.outbox.toArray();
    expect(op).toMatchObject({ opId, entityId: row.id, type: 'upsert' });
    expect(op?.patch).toMatchObject({ status: 'notifie', statusSeq: 3 });
    expect(event).toMatchObject({ entity: 'event', type: 'upsert' });
    expect(event?.patch).toMatchObject({
      entity: 'parcel',
      entityId: row.id,
      type: 'parcel.status',
      detail: { from: 'recu', to: 'notifie' },
      actorId: 'agent-1',
    });
  });

  it('counts from 0 on a row pulled before the counter', async () => {
    const { statusSeq: _seq, ...row } = parcelRow();
    void _seq;
    await db.parcel.put(row);

    await changeParcelStatus(db, row.id, 'a_completer', options);

    expect((await db.parcel.get(row.id))?.statusSeq).toBe(1);
  });

  it('writes nothing for a move outside the graph or a missing parcel', async () => {
    const row = parcelRow({ status: 'a_completer' });
    await db.parcel.put(row);

    await expect(
      changeParcelStatus(db, row.id, 'remis', options),
    ).rejects.toBeInstanceOf(StatusTransitionError);
    await expect(
      changeParcelStatus(db, 'nowhere', 'recu', options),
    ).rejects.toBeInstanceOf(MissingRowError);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.parcel.get(row.id))?.status).toBe('a_completer');
  });
});

describe('stepBackParcel', () => {
  it('takes back the notification', async () => {
    const row = parcelRow({ status: 'notifie', notifiedAt: NOW });
    await db.parcel.put(row);

    await stepBackParcel(db, row.id, options);

    expect(await db.parcel.get(row.id)).toMatchObject({
      status: 'recu',
      notifiedAt: null,
      statusSeq: 1,
    });
    const [, event] = await db.outbox.toArray();
    expect(event?.patch).toMatchObject({
      type: 'parcel.status',
      detail: { from: 'notifie', to: 'recu' },
    });
  });

  it('has nothing to take back from a parcel to complete', async () => {
    const row = parcelRow({ status: 'a_completer' });
    await db.parcel.put(row);

    await expect(stepBackParcel(db, row.id, options)).rejects.toBeInstanceOf(
      StatusTransitionError,
    );
  });
});
