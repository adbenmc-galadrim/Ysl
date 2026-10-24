import type { AnyDb } from '@repo/db';
import type { PGlite } from '@electric-sql/pglite';
import { type SyncOp } from '@repo/contract/sync';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { push } from '#features/sync/push';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  parcelRow,
  STRANGER_ID,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let sync: AnyDb;

const writer = { organizationId: ORGANIZATION_ID, userId: AGENT_ID };
const NOW = new Date('2026-10-24T09:30:00Z');

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  sync = asAnyDb(db);
});

afterAll(async () => {
  await client.close();
});

function op(
  entity: SyncOp['entity'],
  patch: Record<string, unknown> & { id: string },
  type: SyncOp['type'] = 'upsert',
): SyncOp {
  return {
    opId: newId(),
    entity,
    entityId: patch.id,
    type,
    patch,
    clientTs: NOW,
  };
}

function localParcel(overrides: Record<string, unknown> = {}) {
  const { organizationId: _org, ...row } = parcelRow();
  void _org;
  return {
    ...row,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

async function parcel(id: string) {
  const [row] = await db
    .select()
    .from(schema.parcel)
    .where(eq(schema.parcel.id, id));
  return row;
}

async function recorded(opId: string) {
  const [row] = await db
    .select()
    .from(schema.syncOp)
    .where(eq(schema.syncOp.opId, opId));
  return row;
}

describe('sync.push', () => {
  it('applies an upsert and keeps its op_id', async () => {
    const row = localParcel({ notes: 'Étagère A' });
    const change = op('parcel', row);

    const { results } = await push(sync, writer, { ops: [change] });

    expect(results).toEqual([{ opId: change.opId, status: 200 }]);
    expect(await parcel(row.id)).toMatchObject({
      notes: 'Étagère A',
      organizationId: ORGANIZATION_ID,
      updatedAt: NOW,
    });
    expect(await recorded(change.opId)).toMatchObject({
      status: 200,
      userId: AGENT_ID,
      entity: 'parcel',
      entityId: row.id,
    });
  });

  it('answers a repeated operation without writing again', async () => {
    const row = localParcel({ notes: 'première' });
    const change = op('parcel', row);
    await push(sync, writer, { ops: [change] });
    const stamped = await parcel(row.id);

    const { results } = await push(sync, writer, {
      ops: [{ ...change, patch: { ...row, notes: 'rejouée' } }],
    });

    expect(results[0]?.status).toBe(200);
    expect(await parcel(row.id)).toEqual(stamped);
  });

  it('updates a row the device changed, server columns aside', async () => {
    const row = localParcel();
    await push(sync, writer, { ops: [op('parcel', row)] });
    const before = await parcel(row.id);

    const { results } = await push(sync, writer, {
      ops: [
        op('parcel', {
          ...row,
          notes: 'Changé',
          createdAt: new Date('2000-01-01T00:00:00Z'),
          serverXid: 1,
          updatedAt: new Date('2026-10-24T10:00:00Z'),
        }),
      ],
    });
    const after = await parcel(row.id);

    expect(results[0]?.status).toBe(200);
    expect(after?.notes).toBe('Changé');
    expect(after?.createdAt).toEqual(before?.createdAt);
    expect(after?.updatedAt).toEqual(new Date('2026-10-24T10:00:00Z'));
    expect(after?.serverXid).toBeGreaterThan(before?.serverXid ?? Infinity);
  });

  it('refuses a row of another organization and leaves it intact', async () => {
    const theirs = parcelRow(OTHER_ORGANIZATION_ID);
    await db.insert(schema.parcel).values(theirs);
    const change = op('parcel', localParcel({ id: theirs.id, notes: 'volé' }));

    const { results } = await push(sync, writer, { ops: [change] });

    expect(results[0]).toMatchObject({ status: 403 });
    expect(await parcel(theirs.id)).toMatchObject({
      organizationId: OTHER_ORGANIZATION_ID,
      notes: null,
    });
    expect((await recorded(change.opId))?.status).toBe(403);
  });

  it('rejects an unknown column, and answers the same on repeat', async () => {
    const change = op('parcel', localParcel({ colour: 'red' }));

    const first = await push(sync, writer, { ops: [change] });
    const again = await push(sync, writer, { ops: [change] });

    expect(first.results[0]).toMatchObject({ status: 400 });
    expect(first.results[0]?.message).toBe(
      'Données invalides, à corriger sur l’appareil.',
    );
    expect(again.results[0]).toMatchObject({ status: 400 });
    expect(await parcel(change.entityId)).toBeUndefined();
  });

  it('rejects a row missing a required column', async () => {
    const { receivedAt: _receivedAt, ...row } = localParcel();
    void _receivedAt;

    const { results } = await push(sync, writer, { ops: [op('parcel', row)] });

    expect(results[0]).toMatchObject({ status: 400 });
  });

  it('turns a natural-key duplicate into a conflict', async () => {
    const person = (id: string) => ({
      id,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      lastName: 'Martin',
      firstName: 'Camille',
      nameNorm: 'martin camille',
      email: 'camille.martin@example.test',
      department: null,
      site: null,
      source: 'manuel',
      active: true,
    });
    const first = op('directory_person', person(newId()));
    const second = op('directory_person', person(newId()));

    const { results } = await push(sync, writer, { ops: [first, second] });

    expect(results.map((result) => result.status)).toEqual([200, 409]);
    expect((await recorded(second.opId))?.status).toBe(409);
  });

  it('answers 404 for a reference to a row nobody sent', async () => {
    const { results } = await push(sync, writer, {
      ops: [op('parcel', localParcel({ batchId: newId() }))],
    });

    expect(results[0]).toMatchObject({ status: 404 });
  });

  it('applies a batch and its parcels in the order they were made', async () => {
    const batchId = newId();
    const batch = {
      id: batchId,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      agentId: AGENT_ID,
      startedAt: NOW,
      endedAt: NOW,
      parcelCount: 1,
    };

    const { results } = await push(sync, writer, {
      ops: [op('batch', batch), op('parcel', localParcel({ batchId }))],
    });

    expect(results.map((result) => result.status)).toEqual([200, 200]);
  });

  it('deletes logically, and answers 404 for a row it does not hold', async () => {
    const row = localParcel();
    await push(sync, writer, { ops: [op('parcel', row)] });
    const deletedAt = new Date('2026-10-24T11:00:00Z');

    const { results } = await push(sync, writer, {
      ops: [
        op('parcel', { id: row.id, deletedAt }, 'delete'),
        op('parcel', { id: newId(), deletedAt }, 'delete'),
      ],
    });

    expect(results.map((result) => result.status)).toEqual([200, 404]);
    expect((await parcel(row.id))?.deletedAt).toEqual(deletedAt);
  });

  it('keeps a row deleted when a stale copy comes back alive', async () => {
    const row = localParcel({ notes: 'ancienne' });
    await push(sync, writer, { ops: [op('parcel', row)] });
    const deletedAt = new Date('2026-10-24T11:30:00Z');
    await push(sync, writer, {
      ops: [op('parcel', { id: row.id, deletedAt }, 'delete')],
    });

    const { results } = await push(sync, writer, {
      ops: [op('parcel', { ...row, notes: 'en retard', deletedAt: null })],
    });
    const stored = await parcel(row.id);

    expect(results[0]?.status).toBe(200);
    expect(stored?.deletedAt).toEqual(deletedAt);
    expect(stored?.notes).toBe('en retard');
  });

  it('takes an event again without touching the log', async () => {
    const event = {
      id: newId(),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      entity: 'parcel',
      entityId: newId(),
      type: 'received',
      actorId: AGENT_ID,
      at: NOW,
      detail: null,
    };

    const first = await push(sync, writer, { ops: [op('event', event)] });
    const again = await push(sync, writer, {
      ops: [op('event', { ...event, type: 'forged' })],
    });
    const [stored] = await db
      .select()
      .from(schema.event)
      .where(eq(schema.event.id, event.id));

    expect(first.results[0]?.status).toBe(200);
    expect(again.results[0]?.status).toBe(200);
    expect(stored?.type).toBe('received');
  });

  it('refuses an event id another organization logged', async () => {
    const id = newId();
    await db.insert(schema.event).values({
      id,
      organizationId: OTHER_ORGANIZATION_ID,
      entity: 'parcel',
      entityId: newId(),
      type: 'received',
      actorId: STRANGER_ID,
      at: NOW,
    });

    const { results } = await push(sync, writer, {
      ops: [
        op('event', {
          id,
          createdAt: NOW,
          updatedAt: NOW,
          deletedAt: null,
          entity: 'parcel',
          entityId: newId(),
          type: 'received',
          actorId: AGENT_ID,
          at: NOW,
          detail: null,
        }),
      ],
    });

    expect(results[0]).toMatchObject({ status: 403 });
  });

  describe('guards of a delivery (§8.4)', () => {
    const personId = newId();
    const delivered = (overrides: Record<string, unknown> = {}) =>
      localParcel({
        personId,
        status: 'remis',
        deliveredAt: NOW,
        deliveredBy: AGENT_ID,
        ...overrides,
      });
    const handoverRow = (parcelId: string) => ({
      id: newId(),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      parcelIds: [parcelId],
      personId,
      contactId: null,
      recipientName: 'Camille Martin',
      delegateName: null,
      method: 'qr',
      agentId: AGENT_ID,
      at: NOW,
      cancelledAt: null,
    });

    beforeAll(async () => {
      await db.insert(schema.directoryPerson).values({
        id: personId,
        organizationId: ORGANIZATION_ID,
        lastName: 'Durand',
        firstName: 'Lou',
        nameNorm: 'durand lou',
        email: 'lou.durand@example.test',
      });
    });

    it('refuses a stale copy that would undo a delivery, and logs why', async () => {
      const row = delivered();
      await push(sync, writer, { ops: [op('parcel', row)] });
      const stale = op('parcel', {
        ...row,
        status: 'recu',
        deliveredAt: null,
        deliveredBy: null,
        notes: 'copie en retard',
      });

      const first = await push(sync, writer, { ops: [stale] });
      const again = await push(sync, writer, { ops: [stale] });

      expect(first.results[0]).toEqual({
        opId: stale.opId,
        status: 409,
        message:
          'Ce changement de statut n’est pas permis : le colis a évolué sur un autre appareil.',
      });
      expect(again.results[0]?.status).toBe(409);
      expect(await parcel(row.id)).toMatchObject({
        status: 'remis',
        deliveredAt: NOW,
        notes: null,
      });
      expect(await recorded(stale.opId)).toMatchObject({
        status: 409,
        reason: expect.stringMatching(
          /^parcel_status_transition: .*remis to recu/,
        ) as string,
      });
    });

    it('undoes a delivery only after its handover is cancelled', async () => {
      const row = delivered();
      const handover = handoverRow(row.id);
      await push(sync, writer, {
        ops: [op('parcel', row), op('handover', handover)],
      });
      const notified = {
        ...row,
        status: 'notifie',
        deliveredAt: null,
        deliveredBy: null,
      };

      const tooEarly = await push(sync, writer, {
        ops: [op('parcel', notified)],
      });
      const cancelled = await push(sync, writer, {
        ops: [
          op('handover', { ...handover, cancelledAt: NOW }),
          op('parcel', notified),
        ],
      });
      const revived = await push(sync, writer, {
        ops: [op('handover', handover)],
      });

      expect(tooEarly.results[0]).toMatchObject({
        status: 409,
        message:
          'Ce colis a déjà été remis ; la remise est protégée tant qu’elle n’est pas annulée.',
      });
      expect(cancelled.results.map((result) => result.status)).toEqual([
        200, 200,
      ]);
      expect((await parcel(row.id))?.status).toBe('notifie');
      expect(revived.results[0]).toMatchObject({
        status: 409,
        message: 'Cette remise a été annulée ; l’annulation reste.',
      });
    });

    it('keeps the proof of a delivery against an ordinary edit', async () => {
      const row = delivered();
      await push(sync, writer, { ops: [op('parcel', row)] });

      const { results } = await push(sync, writer, {
        ops: [
          op('parcel', {
            ...row,
            deliveredBy: AGENT_ID,
            deliveredAt: new Date('2026-10-25T08:00:00Z'),
          }),
          op('parcel', { ...row, notes: 'Étagère B' }),
        ],
      });

      expect(results.map((result) => result.status)).toEqual([409, 200]);
      expect(await parcel(row.id)).toMatchObject({
        deliveredAt: NOW,
        notes: 'Étagère B',
      });
    });

    it('asks for a recipient before notifying', async () => {
      const { results } = await push(sync, writer, {
        ops: [op('parcel', localParcel({ status: 'notifie' }))],
      });

      expect(results[0]).toMatchObject({
        status: 400,
        message:
          'Un destinataire est requis pour notifier ou remettre un colis.',
      });
    });
  });

  it('stops the batch when the server could not take an operation', async () => {
    const failing = {
      transaction: () =>
        Promise.reject(Object.assign(new Error('deadlock'), { code: '40P01' })),
    } as unknown as AnyDb;
    const ops = [op('parcel', localParcel()), op('parcel', localParcel())];

    const { results } = await push(failing, writer, { ops });

    expect(results).toEqual([
      {
        opId: ops[0]?.opId,
        status: 503,
        message:
          'Le serveur n’a pas pu enregistrer ce changement, nouvel essai plus tard.',
      },
    ]);
  });
});
