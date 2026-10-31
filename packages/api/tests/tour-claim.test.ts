import type { PGlite } from '@electric-sql/pglite';
import type { AnyDb } from '@repo/db';
import * as schema from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pull } from '#features/sync/pull';
import { claimUnclaimed, countUnclaimed } from '#features/tour/service';
import { accessOf } from './helpers/departments';
import {
  addOtherShuttle,
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  OTHER_SHUTTLE_ID,
  parcelRow,
  STRANGER_ID,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let sync: AnyDb;

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  await addOtherShuttle(db);
  sync = asAnyDb(db);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await db
    .update(schema.user)
    .set({ banned: false })
    .where(eq(schema.user.id, OTHER_SHUTTLE_ID));
  await db.delete(schema.parcel);
});

async function addParcel(values: Partial<typeof schema.parcel.$inferInsert>) {
  const row = { ...parcelRow(), ...values };
  await db.insert(schema.parcel).values(row);
  return row.id;
}

describe('parcels on no shuttle tour', () => {
  it('counts those of an account that is not a shuttle, not those of a shuttle or already gone', async () => {
    await addParcel({ receivedBy: AGENT_ID });
    await addParcel({ receivedBy: AGENT_ID, status: 'retourne' });
    await addParcel({ receivedBy: OTHER_SHUTTLE_ID });
    await addParcel({
      organizationId: OTHER_ORGANIZATION_ID,
      receivedBy: STRANGER_ID,
    });
    expect(await countUnclaimed(sync, ORGANIZATION_ID)).toBe(1);
  });

  it('counts the parcels of a suspended shuttle', async () => {
    await addParcel({ receivedBy: OTHER_SHUTTLE_ID });
    await db
      .update(schema.user)
      .set({ banned: true })
      .where(eq(schema.user.id, OTHER_SHUTTLE_ID));
    expect(await countUnclaimed(sync, ORGANIZATION_ID)).toBe(1);
  });

  it('takes them onto the tour of who claims them, and the shuttle then pulls them', async () => {
    const orphan = await addParcel({ receivedBy: AGENT_ID });
    const theirs = await addParcel({ receivedBy: OTHER_SHUTTLE_ID });
    const reader = {
      ...accessOf('shuttle'),
      userId: OTHER_SHUTTLE_ID,
      onTour: true,
    };
    const before = await pull(sync, reader, {
      cursor: null,
      page: null,
      limit: 500,
      departments: true,
    });
    expect(before.rows.map(({ row }) => row.id)).toEqual([theirs]);

    expect(await claimUnclaimed(sync, ORGANIZATION_ID, OTHER_SHUTTLE_ID)).toBe(
      1,
    );
    expect(await countUnclaimed(sync, ORGANIZATION_ID)).toBe(0);

    const after = await pull(sync, reader, {
      cursor: { generation: before.generation, xid: before.cursor },
      page: null,
      limit: 500,
      departments: true,
    });
    expect(after.reset).toBe(false);
    expect(after.rows.map(({ row }) => row.id)).toEqual([orphan]);
    const [row] = await db
      .select({ receivedBy: schema.parcel.receivedBy })
      .from(schema.parcel)
      .where(eq(schema.parcel.id, orphan));
    expect(row?.receivedBy).toBe(AGENT_ID);
  });
});
