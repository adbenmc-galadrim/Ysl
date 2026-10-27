import type { AnyDb } from '@repo/db';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  lastPurge,
  PURGE_BATCH,
  purgeHorizon,
  runPurge,
} from '#features/maintenance/purge';
import { pull } from '#features/sync/pull';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let purgeDb: AnyDb;

const NOW = new Date('2026-10-27T03:00:00Z');
const monthsAgo = (months: number) => {
  const at = new Date(NOW);
  at.setUTCMonth(at.getUTCMonth() - months);
  return at;
};
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  purgeDb = asAnyDb(db);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.purge', 'on', true)`);
    await tx.delete(schema.event);
  });
  await db.delete(schema.handover);
  await db.delete(schema.notification);
  await db.delete(schema.pickupCode);
  await db.delete(schema.parcel);
  await db.delete(schema.batch);
  await db.delete(schema.contact);
  await db.delete(schema.directoryPerson);
  await db.delete(schema.syncOp);
  await db.delete(schema.purgeRun);
});

function contactRow(lastUsedAt: Date, deletedAt: Date | null = null) {
  return {
    id: newId(),
    organizationId: ORGANIZATION_ID,
    name: 'Camille Martin',
    nameNorm: 'camille martin',
    lastUsedAt,
    updatedAt: lastUsedAt,
    deletedAt,
  };
}

function delivered(
  contactId: string,
  deliveredAt: Date,
  deletedAt: Date | null = null,
) {
  return {
    id: newId(),
    organizationId: ORGANIZATION_ID,
    status: 'remis' as const,
    contactId,
    receivedAt: deliveredAt,
    receivedBy: AGENT_ID,
    deliveredAt,
    deliveredBy: AGENT_ID,
    updatedAt: deliveredAt,
    deletedAt,
  };
}

function waiting(contactId: string | null = null) {
  return {
    id: newId(),
    organizationId: ORGANIZATION_ID,
    status: 'recu' as const,
    contactId,
    receivedAt: monthsAgo(14),
    receivedBy: AGENT_ID,
  };
}

function handoverOf(parcelIds: string[], contactId: string) {
  return {
    id: newId(),
    organizationId: ORGANIZATION_ID,
    parcelIds,
    contactId,
    recipientName: 'Camille Martin',
    method: 'manuel' as const,
    agentId: AGENT_ID,
    at: monthsAgo(13),
  };
}

function eventOf(parcelId: string) {
  return {
    id: newId(),
    organizationId: ORGANIZATION_ID,
    entity: 'parcel',
    entityId: parcelId,
    type: 'parcel.status',
    actorId: AGENT_ID,
    at: monthsAgo(13),
  };
}

async function deletedAtOf(
  table: typeof schema.parcel | typeof schema.contact | typeof schema.handover,
  id: string,
) {
  const [row] = await db
    .select({ deletedAt: table.deletedAt })
    .from(table)
    .where(eq(table.id, id));
  return row ? row.deletedAt : 'erased';
}

describe('retention purge, first pass: marks', () => {
  it('marks a parcel handed over 13 months ago, never one of 11 months or one still waiting', async () => {
    const person = contactRow(monthsAgo(1));
    await db.insert(schema.contact).values(person);
    const old = delivered(person.id, monthsAgo(13));
    const young = delivered(person.id, monthsAgo(11));
    const stale = waiting(person.id);
    const returned = {
      ...waiting(),
      status: 'retourne' as const,
      updatedAt: monthsAgo(13),
    };
    await db.insert(schema.parcel).values([old, young, stale, returned]);

    const outcome = await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'manual',
    });

    expect(outcome.status).toBe('done');
    expect(await deletedAtOf(schema.parcel, old.id)).toEqual(NOW);
    expect(await deletedAtOf(schema.parcel, returned.id)).toEqual(NOW);
    expect(await deletedAtOf(schema.parcel, young.id)).toBeNull();
    expect(await deletedAtOf(schema.parcel, stale.id)).toBeNull();
    expect(await deletedAtOf(schema.contact, person.id)).toBeNull();
  });

  it('marks a handover once all its parcels are marked, and the contact they leave unused', async () => {
    const gone = contactRow(monthsAgo(13));
    const kept = contactRow(monthsAgo(13));
    await db.insert(schema.contact).values([gone, kept]);
    const a = delivered(gone.id, monthsAgo(13));
    const b = delivered(gone.id, monthsAgo(13));
    const young = delivered(kept.id, monthsAgo(2));
    await db.insert(schema.parcel).values([a, b, young]);
    const whole = handoverOf([a.id, b.id], gone.id);
    const mixed = handoverOf([a.id, young.id], kept.id);
    await db.insert(schema.handover).values([whole, mixed]);

    await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'auto',
    });

    expect(await deletedAtOf(schema.handover, whole.id)).toEqual(NOW);
    expect(await deletedAtOf(schema.handover, mixed.id)).toBeNull();
    expect(await deletedAtOf(schema.contact, gone.id)).toEqual(NOW);
    expect(await deletedAtOf(schema.contact, kept.id)).toBeNull();
  });

  it('works through more rows than one batch', async () => {
    const person = contactRow(monthsAgo(1));
    await db.insert(schema.contact).values(person);
    const rows = Array.from({ length: PURGE_BATCH + 20 }, () =>
      delivered(person.id, monthsAgo(13)),
    );
    await db.insert(schema.parcel).values(rows);

    const outcome = await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'auto',
    });

    expect(outcome).toMatchObject({
      status: 'done',
      runs: [{ counts: { parcel: { marked: PURGE_BATCH + 20, deleted: 0 } } }],
    });
  });

  it('leaves another mailroom alone when an admin purges theirs', async () => {
    const theirs = {
      id: newId(),
      organizationId: OTHER_ORGANIZATION_ID,
      name: 'Autre',
      nameNorm: 'autre',
      lastUsedAt: monthsAgo(20),
      updatedAt: monthsAgo(20),
    };
    await db.insert(schema.contact).values(theirs);

    await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'manual',
    });

    expect(await deletedAtOf(schema.contact, theirs.id)).toBeNull();
  });
});

describe('retention purge, second pass: erasure', () => {
  it('erases rows marked over 30 days ago with their events, keeps those of 29 days', async () => {
    const person = contactRow(monthsAgo(1));
    await db.insert(schema.contact).values(person);
    const old = delivered(person.id, monthsAgo(14), daysAgo(31));
    const recent = delivered(person.id, monthsAgo(14), daysAgo(29));
    await db.insert(schema.parcel).values([old, recent]);
    await db
      .insert(schema.event)
      .values([eventOf(old.id), eventOf(old.id), eventOf(recent.id)]);

    const outcome = await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'auto',
    });

    expect(await deletedAtOf(schema.parcel, old.id)).toBe('erased');
    expect(await deletedAtOf(schema.parcel, recent.id)).toEqual(daysAgo(29));
    const events = await db
      .select({ entityId: schema.event.entityId })
      .from(schema.event);
    expect(events).toEqual([{ entityId: recent.id }]);
    expect(outcome).toMatchObject({
      runs: [
        {
          counts: {
            parcel: { marked: 0, deleted: 1 },
            event: { marked: 0, deleted: 2 },
          },
        },
      ],
    });
  });

  it('keeps a marked contact while a parcel still points to it, without breaking a key', async () => {
    const person = contactRow(monthsAgo(14), daysAgo(40));
    await db.insert(schema.contact).values(person);
    const parcel = delivered(person.id, monthsAgo(14), daysAgo(10));
    await db.insert(schema.parcel).values(parcel);
    await db.insert(schema.pickupCode).values({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      contactId: person.id,
      tokenHash: 'token',
      pinHash: 'pin',
      expiresAt: monthsAgo(14),
      deletedAt: daysAgo(10),
    });

    await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'auto',
    });

    expect(await deletedAtOf(schema.contact, person.id)).toEqual(daysAgo(40));
    expect(await deletedAtOf(schema.parcel, parcel.id)).toEqual(daysAgo(10));
  });

  it('erases parcels, then the contact and the batch they pointed to, in one run', async () => {
    const person = contactRow(monthsAgo(14), daysAgo(40));
    await db.insert(schema.contact).values(person);
    const batch = {
      id: newId(),
      organizationId: ORGANIZATION_ID,
      agentId: AGENT_ID,
      startedAt: monthsAgo(14),
      deletedAt: daysAgo(40),
    };
    await db.insert(schema.batch).values(batch);
    const parcel = {
      ...delivered(person.id, monthsAgo(14), daysAgo(40)),
      batchId: batch.id,
    };
    await db.insert(schema.parcel).values(parcel);
    await db
      .insert(schema.handover)
      .values({
        ...handoverOf([parcel.id], person.id),
        deletedAt: daysAgo(40),
      });

    await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'auto',
    });

    expect(await db.select().from(schema.parcel)).toEqual([]);
    expect(await db.select().from(schema.handover)).toEqual([]);
    expect(await db.select().from(schema.batch)).toEqual([]);
    expect(await db.select().from(schema.contact)).toEqual([]);
  });

  it('forgets pushed operations after 90 days', async () => {
    const op = (appliedAt: Date) => ({
      organizationId: ORGANIZATION_ID,
      opId: newId(),
      userId: AGENT_ID,
      entity: 'parcel' as const,
      entityId: newId(),
      status: 200,
      appliedAt,
    });
    const old = op(daysAgo(91));
    const recent = op(daysAgo(89));
    await db.insert(schema.syncOp).values([old, recent]);

    await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'auto',
    });

    const left = await db
      .select({ opId: schema.syncOp.opId })
      .from(schema.syncOp);
    expect(left).toEqual([{ opId: recent.opId }]);
  });
});

describe('retention purge, record and horizon', () => {
  it('records the run, and moves the horizon past what it erased', async () => {
    const person = contactRow(monthsAgo(1));
    await db.insert(schema.contact).values(person);
    const old = delivered(person.id, monthsAgo(14), daysAgo(31));
    await db.insert(schema.parcel).values(old);
    const [stamped] = await db
      .select({ xid: schema.parcel.serverXid })
      .from(schema.parcel)
      .where(eq(schema.parcel.id, old.id));

    await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'manual',
      userId: AGENT_ID,
    });

    expect(await purgeHorizon(purgeDb, ORGANIZATION_ID)).toBe(stamped!.xid + 1);
    expect(await purgeHorizon(purgeDb, OTHER_ORGANIZATION_ID)).toBe(0);
    expect(await lastPurge(purgeDb, ORGANIZATION_ID)).toMatchObject({
      trigger: 'manual',
      startedAt: NOW,
      counts: { parcel: { marked: 0, deleted: 1 } },
    });
  });

  it('sends a device that never pulled an erased mark back to the start', async () => {
    const person = contactRow(monthsAgo(1));
    await db.insert(schema.contact).values(person);
    const old = delivered(person.id, monthsAgo(14), daysAgo(31));
    await db.insert(schema.parcel).values(old);
    const [generation] = await db.select().from(schema.syncGeneration);
    const before = await pull(purgeDb, ORGANIZATION_ID, {
      cursor: null,
      page: null,
      limit: 200,
    });
    const behind = { generation: generation!.generation, xid: 1 };

    await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'auto',
    });

    const late = await pull(purgeDb, ORGANIZATION_ID, {
      cursor: behind,
      page: null,
      limit: 200,
    });
    const upToDate = await pull(purgeDb, ORGANIZATION_ID, {
      cursor: { generation: generation!.generation, xid: before.cursor },
      page: null,
      limit: 200,
    });
    expect(late.reset).toBe(true);
    expect(late.rows.map((change) => change.row.id)).not.toContain(old.id);
    expect(upToDate.reset).toBe(false);
  });
});

describe('retention purge, inactive people', () => {
  it('erases nobody active, and marks a person who left 30 days ago once unused', async () => {
    const person = (active: boolean, updatedAt: Date) => ({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      lastName: 'Martin',
      firstName: 'Camille',
      nameNorm: 'camille martin',
      email: `${newId()}@example.test`,
      active,
      updatedAt,
    });
    const left = person(false, daysAgo(31));
    const justLeft = person(false, daysAgo(5));
    const active = person(true, monthsAgo(30));
    await db.insert(schema.directoryPerson).values([left, justLeft, active]);

    await runPurge(purgeDb, {
      now: NOW,
      organizationId: ORGANIZATION_ID,
      trigger: 'auto',
    });

    const rows = await db
      .select({
        id: schema.directoryPerson.id,
        deletedAt: schema.directoryPerson.deletedAt,
      })
      .from(schema.directoryPerson)
      .where(
        inArray(schema.directoryPerson.id, [left.id, justLeft.id, active.id]),
      );
    const deletedAt = new Map(rows.map((row) => [row.id, row.deletedAt]));
    expect(deletedAt.get(left.id)).toEqual(NOW);
    expect(deletedAt.get(justLeft.id)).toBeNull();
    expect(deletedAt.get(active.id)).toBeNull();
  });
});
