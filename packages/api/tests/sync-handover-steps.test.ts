import type { PGlite } from '@electric-sql/pglite';
import {
  SMALL_SITE_OPERATING_PROFILE,
  type OperatingProfile,
} from '@repo/contract/operating-profile';
import { PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import type { SyncOp, SyncedEntity } from '@repo/contract/sync';
import type { AnyDb } from '@repo/db';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeOperatingProfile } from '#features/operating/service';
import { push } from '#features/sync/push';
import { accessOf, addPerson } from './helpers/departments';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let sync: AnyDb;
let personId: string;

const SIGNATURE_REQUIRED: OperatingProfile = {
  ...SMALL_SITE_OPERATING_PROFILE,
  signature: 'required',
};

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  sync = asAnyDb(db);
  personId = await addPerson(db, null);
});

afterAll(async () => {
  await client.close();
});

function op(
  entity: SyncedEntity,
  entityId: string,
  patch: Record<string, unknown>,
): SyncOp {
  return {
    opId: newId(),
    entity,
    entityId,
    type: 'upsert',
    patch,
    clientTs: new Date(),
  };
}

/** The ops a phone queues for one handover, in their order. */
async function handoverOps(values: Record<string, unknown>) {
  const parcel = newId();
  const row = {
    ...parcelRow(),
    id: parcel,
    personId,
    status: 'notifie' as const,
    statusSeq: 1,
    notifiedAt: new Date(),
  };
  await db.insert(schema.parcel).values(row);
  const id = newId();
  const at = new Date();
  return {
    parcel,
    id,
    ops: [
      op('handover', id, {
        parcelIds: [parcel],
        personId,
        recipientName: 'Léa Martin',
        method: 'manuel',
        agentId: AGENT_ID,
        at,
        ...values,
      }),
      op('parcel', parcel, {
        ...row,
        status: 'remis',
        statusSeq: 2,
        deliveredAt: at,
        deliveredBy: AGENT_ID,
      }),
      op('event', newId(), {
        entity: PARCEL_EVENT_ENTITY,
        entityId: parcel,
        type: 'parcel.delivered',
        detail: { handoverId: id, method: values.method ?? 'manuel' },
        actorId: AGENT_ID,
        at,
      }),
    ],
  };
}

const statuses = async (ops: SyncOp[]) =>
  (await push(sync, accessOf('shuttle'), { ops })).results.map(
    (result) => result.status,
  );

const statusOfParcel = async (id: string) => {
  const [row] = await db
    .select({ status: schema.parcel.status })
    .from(schema.parcel)
    .where(eq(schema.parcel.id, id));
  return row?.status;
};

describe('the profile on the handovers pushed', () => {
  it('Petit site: a bare handover by the name goes through, as in production', async () => {
    await writeOperatingProfile(
      sync,
      ORGANIZATION_ID,
      SMALL_SITE_OPERATING_PROFILE,
      AGENT_ID,
    );
    const { ops, parcel } = await handoverOps({ hasScan: false });
    expect(await statuses(ops)).toEqual([200, 200, 200]);
    expect(await statusOfParcel(parcel)).toBe('remis');
  });

  it('refuses a handover without the required signature, its parcel and event with it, and says why', async () => {
    await writeOperatingProfile(
      sync,
      ORGANIZATION_ID,
      SIGNATURE_REQUIRED,
      AGENT_ID,
    );
    const { ops, parcel, id } = await handoverOps({ hasScan: false });
    const { results } = await push(sync, accessOf('shuttle'), { ops });
    expect(results.map((result) => result.status)).toEqual([403, 403, 403]);
    expect(results[0]?.message).toContain('exige désormais');
    expect(await statusOfParcel(parcel)).toBe('notifie');
    expect(
      await db.select().from(schema.handover).where(eq(schema.handover.id, id)),
    ).toEqual([]);
  });

  it('accepts the handover once it carries the step', async () => {
    const { ops, parcel } = await handoverOps({
      hasScan: false,
      method: 'signature',
      hasSignature: true,
    });
    expect(await statuses(ops)).toEqual([200, 200, 200]);
    expect(await statusOfParcel(parcel)).toBe('remis');
  });

  it('an older version, which does not know the rule, is accepted and nothing is lost', async () => {
    const { ops, parcel } = await handoverOps({});
    expect(await statuses(ops)).toEqual([200, 200, 200]);
    expect(await statusOfParcel(parcel)).toBe('remis');
  });

  it('a handover made before the profile changed is accepted, even pushed after', async () => {
    const { ops, parcel } = await handoverOps({ hasScan: false });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await writeOperatingProfile(
      sync,
      ORGANIZATION_ID,
      { ...SIGNATURE_REQUIRED, photo: 'required' },
      AGENT_ID,
    );
    expect(await statuses(ops)).toEqual([200, 200, 200]);
    expect(await statusOfParcel(parcel)).toBe('remis');
  });

  it('a later change to a handover already kept is not checked again', async () => {
    const { ops } = await handoverOps({
      hasScan: false,
      method: 'signature',
      hasSignature: true,
      hasPhoto: true,
    });
    await statuses(ops);
    await writeOperatingProfile(
      sync,
      ORGANIZATION_ID,
      { ...SIGNATURE_REQUIRED, handoverScan: 'required' },
      AGENT_ID,
    );
    const [write] = ops;
    expect(
      await statuses([
        {
          ...write!,
          opId: newId(),
          patch: { ...write!.patch, hasPhoto: true },
        },
      ]),
    ).toEqual([200]);
  });
});
