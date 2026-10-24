import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@repo/shared/id';
import * as schema from '#schema/index';
import {
  canTransition,
  PARCEL_STATUSES,
  type ParcelStatus,
} from '#schema/parcel';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

const client = new PGlite();
const db = drizzle({ client, schema });

const agentId = 'agent-1';
const organizationId = newId();
const AT = new Date('2026-10-24T10:00:00Z');

type Failure = { constraint?: string; message?: string };

async function failureOf(write: Promise<unknown>): Promise<Failure | null> {
  return write.then(
    () => null,
    (caught: unknown) => {
      let current: unknown = caught;
      for (let depth = 0; current && depth < 4; depth += 1) {
        const { constraint, cause, message } = current as {
          constraint?: string;
          cause?: unknown;
          message?: string;
        };
        if (constraint) return { constraint, message };
        current = cause;
      }
      return { message: (caught as Error).message };
    },
  );
}

const DELIVERY = { deliveredAt: AT, deliveredBy: agentId };

/** The columns a status needs to satisfy the checks of the table. */
function columnsFor(status: ParcelStatus) {
  return status === 'remis'
    ? { status, ...DELIVERY }
    : { status, deliveredAt: null, deliveredBy: null };
}

async function insertParcel(status: ParcelStatus, personId: string) {
  const id = newId();
  await db.insert(schema.parcel).values({
    id,
    organizationId,
    personId,
    receivedAt: AT,
    receivedBy: agentId,
    ...columnsFor(status),
  });
  return id;
}

async function setStatus(id: string, status: ParcelStatus) {
  return failureOf(
    db
      .update(schema.parcel)
      .set(columnsFor(status))
      .where(eq(schema.parcel.id, id)),
  );
}

async function insertHandover(parcelId: string, personId: string) {
  const id = newId();
  await db.insert(schema.handover).values({
    id,
    organizationId,
    parcelIds: [parcelId],
    personId,
    recipientName: 'Camille Martin',
    method: 'qr',
    agentId,
    at: AT,
  });
  return id;
}

async function insertCancelledHandover(parcelId: string, personId: string) {
  const id = await insertHandover(parcelId, personId);
  await db
    .update(schema.handover)
    .set({ cancelledAt: AT })
    .where(eq(schema.handover.id, id));
  return id;
}

async function statusOf(id: string) {
  const [row] = await db
    .select({ status: schema.parcel.status })
    .from(schema.parcel)
    .where(eq(schema.parcel.id, id));
  return row?.status;
}

let personId: string;

beforeAll(async () => {
  await migrate(db, { migrationsFolder });
  await db
    .insert(schema.organization)
    .values({ id: organizationId, name: 'Service courrier' });
  await db
    .insert(schema.user)
    .values({ id: agentId, name: 'Agent', email: 'agent@example.test' });
  await db
    .insert(schema.organizationMember)
    .values({ userId: agentId, organizationId });
  personId = newId();
  await db.insert(schema.directoryPerson).values({
    id: personId,
    organizationId,
    lastName: 'Martin',
    firstName: 'Camille',
    nameNorm: 'martin camille',
    email: 'camille.martin@example.test',
  });
});

afterAll(async () => {
  await client.close();
});

describe('parcel status transitions', () => {
  it('accept exactly the moves of PARCEL_TRANSITIONS', async () => {
    const pairs = PARCEL_STATUSES.flatMap((from) =>
      PARCEL_STATUSES.map((to) => [from, to] as const),
    );
    const outcome: Record<string, boolean> = {};
    const expected: Record<string, boolean> = {};

    for (const [from, to] of pairs) {
      const id = await insertParcel(from, personId);
      if (from === 'remis') await insertCancelledHandover(id, personId);
      const failure = await setStatus(id, to);
      outcome[`${from} -> ${to}`] = failure === null;
      expected[`${from} -> ${to}`] = canTransition(from, to);
      if (failure) {
        expect(failure.constraint).toBe('parcel_status_transition');
        expect(await statusOf(id)).toBe(from);
      }
    }

    expect(outcome).toEqual(expected);
    expect(Object.values(expected).filter(Boolean)).toHaveLength(12);
  });

  it('require a recipient to notify or hand over', async () => {
    const nobody = {
      id: newId(),
      organizationId,
      receivedAt: AT,
      receivedBy: agentId,
    };

    expect(
      await failureOf(
        db.insert(schema.parcel).values({ ...nobody, status: 'notifie' }),
      ),
    ).toMatchObject({ constraint: 'parcel_recipient_check' });
    expect(
      await failureOf(
        db
          .insert(schema.parcel)
          .values({ ...nobody, id: newId(), status: 'remis', ...DELIVERY }),
      ),
    ).toMatchObject({ constraint: 'parcel_recipient_check' });
    expect(
      await failureOf(
        db
          .insert(schema.parcel)
          .values({ ...nobody, id: newId(), status: 'recu' }),
      ),
    ).toBeNull();
  });

  it('keep the proof of a delivery', async () => {
    const id = await insertParcel('remis', personId);

    const movedAt = await failureOf(
      db
        .update(schema.parcel)
        .set({ deliveredAt: new Date('2026-10-25T08:00:00Z') })
        .where(eq(schema.parcel.id, id)),
    );
    const notes = await failureOf(
      db
        .update(schema.parcel)
        .set({ notes: 'Étagère B' })
        .where(eq(schema.parcel.id, id)),
    );

    expect(movedAt).toMatchObject({ constraint: 'parcel_delivery_protected' });
    expect(notes).toBeNull();
  });

  it('undo a delivery only once its handover is cancelled', async () => {
    const id = await insertParcel('remis', personId);
    const handoverId = await insertHandover(id, personId);

    const whileHandedOver = await setStatus(id, 'notifie');
    await db
      .update(schema.handover)
      .set({ cancelledAt: new Date('2026-10-24T11:00:00Z') })
      .where(eq(schema.handover.id, handoverId));
    const onceCancelled = await setStatus(id, 'notifie');

    expect(whileHandedOver).toMatchObject({
      constraint: 'parcel_delivery_protected',
    });
    expect(onceCancelled).toBeNull();
    expect(await statusOf(id)).toBe('notifie');
  });

  it('refuse to undo a delivery that has no cancelled handover', async () => {
    const alone = await insertParcel('remis', personId);
    const deleted = await insertParcel('remis', personId);
    const handoverId = await insertHandover(deleted, personId);
    await db
      .update(schema.handover)
      .set({ deletedAt: new Date('2026-10-24T11:00:00Z') })
      .where(eq(schema.handover.id, handoverId));

    expect(await setStatus(alone, 'notifie')).toMatchObject({
      constraint: 'parcel_delivery_protected',
    });
    expect(await setStatus(deleted, 'notifie')).toMatchObject({
      constraint: 'parcel_delivery_protected',
    });
  });

  it('keep the parcels of a handover', async () => {
    const first = await insertParcel('remis', personId);
    const second = await insertParcel('remis', personId);
    const handoverId = await insertHandover(first, personId);

    const added = await failureOf(
      db
        .update(schema.handover)
        .set({ parcelIds: [first, second] })
        .where(eq(schema.handover.id, handoverId)),
    );
    const removed = await failureOf(
      db
        .update(schema.handover)
        .set({ parcelIds: [second] })
        .where(eq(schema.handover.id, handoverId)),
    );

    expect(added).toBeNull();
    expect(removed).toMatchObject({ constraint: 'handover_parcels_sticky' });
  });

  it('keep a handover cancelled', async () => {
    const id = await insertParcel('remis', personId);
    const handoverId = await insertHandover(id, personId);
    const cancelledAt = new Date('2026-10-24T11:00:00Z');
    await db
      .update(schema.handover)
      .set({ cancelledAt })
      .where(eq(schema.handover.id, handoverId));

    const revived = await failureOf(
      db
        .update(schema.handover)
        .set({ cancelledAt: null })
        .where(eq(schema.handover.id, handoverId)),
    );
    const later = await failureOf(
      db
        .update(schema.handover)
        .set({ cancelledAt: new Date('2026-10-24T12:00:00Z') })
        .where(eq(schema.handover.id, handoverId)),
    );
    const [row] = await db
      .select({ cancelledAt: schema.handover.cancelledAt })
      .from(schema.handover)
      .where(eq(schema.handover.id, handoverId));

    expect(revived).toMatchObject({ constraint: 'handover_cancel_sticky' });
    expect(later).toMatchObject({ constraint: 'handover_cancel_sticky' });
    expect(row?.cancelledAt).toEqual(cancelledAt);
  });
});
