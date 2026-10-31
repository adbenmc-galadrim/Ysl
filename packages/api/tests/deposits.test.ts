import type { PGlite } from '@electric-sql/pglite';
import type { SyncOp } from '@repo/contract/sync';
import type { AnyDb } from '@repo/db';
import { DEFAULT_OPERATING_PROFILE } from '@repo/contract/operating-profile';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  confirmDeposit,
  entrustParcels,
  settleParcel,
} from '#features/deposits/service';
import { saveOperatingProfile } from '#features/operating/service';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';
import { accessOf, addDepartment, addPerson } from './helpers/departments';
import {
  addOtherShuttle,
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  OTHER_SHUTTLE_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let sync: AnyDb;
let finance: string;
let legal: string;

const actor = {
  organizationId: ORGANIZATION_ID,
  userId: AGENT_ID,
  name: 'Julie',
};
const admin = {
  organizationId: ORGANIZATION_ID,
  userId: AGENT_ID,
  name: 'Ada',
};
const shuttle = { ...accessOf('shuttle'), onTour: true };
const NOW = new Date('2026-10-31T09:00:00Z');

function op(
  entity: SyncOp['entity'],
  entityId: string,
  patch: Record<string, unknown>,
): SyncOp {
  return {
    opId: newId(),
    entity,
    entityId,
    type: 'upsert',
    patch,
    clientTs: NOW,
  };
}

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  await addOtherShuttle(db);
  sync = asAnyDb(db);
  finance = await addDepartment(db, 'Finance');
  legal = await addDepartment(db, 'Juridique');
  await setProfile('count');
});

async function setProfile(depositConfirmation: 'count' | 'disabled') {
  await db.delete(schema.setting);
  await db.insert(schema.setting).values({
    id: newId(),
    organizationId: ORGANIZATION_ID,
    key: 'operatingProfile',
    value: {
      ...DEFAULT_OPERATING_PROFILE,
      shuttleActsAsDepartment: false,
      depositConfirmation,
    },
  });
}

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await db.delete(schema.deposit);
  await db.delete(schema.parcel);
});

async function onRoute(
  values: Partial<typeof schema.parcel.$inferInsert> = {},
) {
  const row = {
    ...parcelRow(),
    status: 'en_route' as const,
    departmentId: finance,
    ...values,
  };
  await db.insert(schema.parcel).values(row);
  return row.id;
}

async function announced(parcelIds: string[], departmentId = finance) {
  const id = newId();
  const { results } = await push(sync, shuttle, {
    ops: [
      op('deposit', id, {
        departmentId,
        parcelIds,
        announced: parcelIds.length,
        postedAt: NOW,
        shuttleId: 'someone-else',
      }),
    ],
  });
  expect(results[0]?.status).toBe(200);
  return id;
}

async function parcelOf(id: string) {
  const [row] = await db
    .select()
    .from(schema.parcel)
    .where(eq(schema.parcel.id, id));
  return row!;
}

const confirm = (depositId: string, counted: number) =>
  confirmDeposit(sync, actor, finance, { depositId, counted, gap: null });

describe('a deposit', () => {
  it('leaves the parcels on their way until the department counts them, offline writes included', async () => {
    const id = await onRoute();
    const depositId = await announced([id]);
    const [row] = await db
      .select()
      .from(schema.deposit)
      .where(eq(schema.deposit.id, depositId));
    expect(row?.shuttleId).toBe(AGENT_ID);
    expect((await parcelOf(id)).status).toBe('en_route');
  });

  it('goes « Déposé », or « Notifié » with an e-mail traced, with its counter, on the count', async () => {
    const plain = await onRoute();
    const told = await onRoute({
      lastNotifiedAt: NOW,
      personId: await addPerson(db, finance),
    });
    const depositId = await announced([plain, told]);

    expect(await confirm(depositId, 2)).toEqual({ deposited: 2, toSettle: 0 });

    const one = await parcelOf(plain);
    expect(one).toMatchObject({ status: 'depose', statusSeq: 1 });
    expect(one.depositedAt).toBeInstanceOf(Date);
    const two = await parcelOf(told);
    expect(two.status).toBe('notifie');
    expect(two.lastNotifiedAt).toEqual(NOW);
    await expect(confirm(depositId, 2)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('refuses a count that does not match without a gap, and another department', async () => {
    const depositId = await announced([await onRoute(), await onRoute()]);
    await expect(confirm(depositId, 1)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(
      confirmDeposit(sync, actor, legal, { depositId, counted: 2, gap: null }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('blocks the parcels the department names, or all of them when it cannot say', async () => {
    const short = await onRoute();
    const there = await onRoute();
    const named = await announced([short, there]);
    await confirmDeposit(sync, actor, finance, {
      depositId: named,
      counted: 1,
      gap: { kind: 'missing', parcelIds: [short] },
    });
    expect((await parcelOf(short)).status).toBe('a_regulariser');
    expect((await parcelOf(short)).depositedAt).toBeNull();
    expect((await parcelOf(there)).status).toBe('depose');

    const a = await onRoute();
    const b = await onRoute();
    const unknown = await announced([a, b]);
    expect(
      await confirmDeposit(sync, actor, finance, {
        depositId: unknown,
        counted: 1,
        gap: { kind: 'missing', parcelIds: null },
      }),
    ).toEqual({ deposited: 0, toSettle: 2 });
  });

  it('keeps an extra as a count: no listed parcel is blocked', async () => {
    const id = await onRoute();
    const depositId = await announced([id]);
    await confirmDeposit(sync, actor, finance, {
      depositId,
      counted: 2,
      gap: { kind: 'extra', parcelIds: null },
    });
    expect((await parcelOf(id)).status).toBe('depose');
  });

  it('marks as there the parcel of an employee gone', async () => {
    const id = await onRoute();
    const depositId = await announced([id]);
    await confirmDeposit(sync, actor, finance, {
      depositId,
      counted: 1,
      gap: { kind: 'left', parcelIds: [id] },
    });
    const row = await parcelOf(id);
    expect(row.status).toBe('a_regulariser');
    expect(row.depositedAt).toBeInstanceOf(Date);
  });

  it('confirms by itself on a profile with no confirmation', async () => {
    await setProfile('disabled');
    const id = await onRoute();
    await announced([id]);
    await setProfile('count');
    expect((await parcelOf(id)).status).toBe('depose');
  });

  it('cannot be announced for the parcels of another shuttle, nor by any other role', async () => {
    const theirs = await onRoute({ receivedBy: OTHER_SHUTTLE_ID });
    const write = op('deposit', newId(), {
      departmentId: finance,
      parcelIds: [theirs],
      announced: 1,
      postedAt: NOW,
    });
    expect(
      (await push(sync, shuttle, { ops: [write] })).results[0]?.status,
    ).toBe(403);
    const mine = await onRoute();
    const asDepartment = op('deposit', newId(), {
      departmentId: finance,
      parcelIds: [mine],
      announced: 1,
      postedAt: NOW,
    });
    expect(
      (
        await push(sync, accessOf('department', finance), {
          ops: [asDepartment],
        })
      ).results[0]?.status,
    ).toBe(403);
  });

  it('keeps what the server wrote against a copy pushed again', async () => {
    const id = await onRoute();
    const depositId = await announced([id]);
    await confirm(depositId, 1);
    await push(sync, shuttle, {
      ops: [
        op('deposit', depositId, {
          departmentId: finance,
          parcelIds: [id],
          announced: 1,
          postedAt: NOW,
          counted: 9,
        }),
      ],
    });
    const [row] = await db
      .select()
      .from(schema.deposit)
      .where(eq(schema.deposit.id, depositId));
    expect(row?.counted).toBe(1);
  });

  it('comes down only to a PWA that asks, and to its department or its shuttle', async () => {
    const depositId = await announced([await onRoute()]);
    const entities = async (
      access: Parameters<typeof pull>[1],
      deposits?: true,
    ) =>
      (
        await pull(sync, access, {
          cursor: null,
          page: null,
          limit: 500,
          departments: true,
          tourStatuses: true,
          deposits,
        })
      ).rows
        .filter(({ entity }) => entity === 'deposit')
        .map(({ row }) => row.id);
    expect(await entities(shuttle)).toEqual([]);
    expect(await entities(shuttle, true)).toEqual([depositId]);
    expect(await entities(accessOf('department', finance), true)).toEqual([
      depositId,
    ]);
    expect(await entities(accessOf('department', legal), true)).toEqual([]);
  });
});

describe('the profile', () => {
  it('parcel by parcel: what did not arrive waits, and a bare count is refused', async () => {
    const here = await onRoute();
    const gone = await onRoute();
    const depositId = await announced([here, gone]);
    const each = { each: true };
    await expect(
      confirmDeposit(
        sync,
        actor,
        finance,
        { depositId, counted: 2, gap: null },
        each,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await confirmDeposit(
      sync,
      actor,
      finance,
      { depositId, counted: 1, gap: null, received: [here] },
      each,
    );
    expect((await parcelOf(here)).status).toBe('depose');
    expect((await parcelOf(gone)).status).toBe('a_regulariser');
  });

  it('turning the confirmation off settles what already waits (D31)', async () => {
    const id = await onRoute();
    await announced([id]);
    await saveOperatingProfile(
      sync,
      ORGANIZATION_ID,
      {
        ...DEFAULT_OPERATING_PROFILE,
        shuttleActsAsDepartment: false,
        depositConfirmation: 'disabled',
      },
      AGENT_ID,
    );
    await setProfile('count');
    expect((await parcelOf(id)).status).toBe('depose');
  });
});

describe('what a device cannot write', () => {
  const write = (id: string, status: string, statusSeq = 1) =>
    push(sync, shuttle, {
      ops: [
        op('parcel', id, {
          status,
          statusSeq,
          departmentId: finance,
          receivedAt: NOW,
          receivedBy: AGENT_ID,
        }),
      ],
    });

  it.each(['depose', 'notifie', 'a_regulariser'])(
    'en_route to %s',
    async (status) => {
      const id = await onRoute();
      expect((await write(id, status)).results[0]?.status).toBe(403);
      expect((await parcelOf(id)).status).toBe('en_route');
    },
  );

  it('a stale step out of « À régulariser »', async () => {
    const id = await onRoute({ status: 'a_regulariser' });
    expect((await write(id, 'en_route')).results[0]?.status).toBe(403);
  });
});

describe('settling a parcel', () => {
  const blocked = (values: Partial<typeof schema.parcel.$inferInsert> = {}) =>
    onRoute({ status: 'a_regulariser', ...values });

  it('sends it back on its way with its e-mail kept for the same department', async () => {
    const id = await blocked({ lastNotifiedAt: NOW });
    await settleParcel(sync, admin, { action: 'redeposit', parcelId: id });
    const row = await parcelOf(id);
    expect(row).toMatchObject({
      status: 'en_route',
      statusSeq: 1,
      departmentId: finance,
    });
    expect(row.lastNotifiedAt).toEqual(NOW);
  });

  it('forgets the e-mail when it goes elsewhere: the deposit tells again', async () => {
    const id = await blocked({ lastNotifiedAt: NOW });
    await settleParcel(sync, admin, {
      action: 'department',
      parcelId: id,
      departmentId: legal,
    });
    const row = await parcelOf(id);
    expect(row).toMatchObject({ status: 'en_route', departmentId: legal });
    expect(row.lastNotifiedAt).toBeNull();
  });

  it('moves a parcel for a person only through a person', async () => {
    const person = await addPerson(db, finance);
    const other = await addPerson(db, legal);
    const id = await blocked({ personId: person });
    await expect(
      settleParcel(sync, admin, {
        action: 'department',
        parcelId: id,
        departmentId: legal,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await settleParcel(sync, admin, {
      action: 'person',
      parcelId: id,
      personId: other,
    });
    expect(await parcelOf(id)).toMatchObject({
      status: 'en_route',
      personId: other,
      departmentId: legal,
    });
  });

  it('places a parcel with no department, for the department to see it', async () => {
    const row = { ...parcelRow(), status: 'recu' as const };
    await db.insert(schema.parcel).values(row);
    await settleParcel(sync, admin, {
      action: 'department',
      parcelId: row.id,
      departmentId: legal,
    });
    expect(await parcelOf(row.id)).toMatchObject({
      status: 'recu',
      departmentId: legal,
    });
  });

  it('closes it, lost saying so', async () => {
    const id = await blocked();
    await settleParcel(sync, admin, { action: 'lost', parcelId: id });
    const row = await parcelOf(id);
    expect(row.status).toBe('retourne');
    expect(row.notes).toContain('perdu');
  });

  it('refuses a parcel that no longer waits', async () => {
    const id = await onRoute();
    await expect(
      settleParcel(sync, admin, { action: 'redeposit', parcelId: id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('a stale copy of a parcel with nobody', () => {
  it('does not bring it back to its old department', async () => {
    const id = await onRoute({ status: 'recu', departmentId: legal });
    const { results } = await push(sync, accessOf('company_admin'), {
      ops: [
        op('parcel', id, {
          status: 'recu',
          departmentId: finance,
          receivedAt: NOW,
          receivedBy: AGENT_ID,
        }),
      ],
    });
    expect(results[0]?.status).toBe(200);
    expect((await parcelOf(id)).departmentId).toBe(legal);
  });
});

describe('entrusting parcels', () => {
  it('takes them from a shuttle away, off its phone and its deposit', async () => {
    const id = await onRoute();
    const stay = await onRoute();
    const depositId = await announced([id, stay]);

    expect(await entrustParcels(sync, admin, [id], OTHER_SHUTTLE_ID)).toBe(1);

    const pulled = await pull(sync, shuttle, {
      cursor: null,
      page: null,
      limit: 500,
      departments: true,
      tourStatuses: true,
    });
    const row = pulled.rows.find((change) => change.row.id === id)?.row;
    expect(row?.deletedAt).toBeInstanceOf(Date);
    const [kept] = await db
      .select()
      .from(schema.deposit)
      .where(eq(schema.deposit.id, depositId));
    expect(kept?.parcelIds).toEqual([stay]);
    expect(kept?.announced).toBe(1);
  });

  it('refuses an account that is no shuttle', async () => {
    const id = await onRoute();
    await expect(
      entrustParcels(sync, admin, [id], 'nobody'),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
