import type { PGlite } from '@electric-sql/pglite';
import type { SyncOp } from '@repo/contract/sync';
import type { AnyDb } from '@repo/db';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';
import { accessOf, addDepartment, addPerson } from './helpers/departments';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let sync: AnyDb;
let finance: string;
let personId: string;

const shuttle = { ...accessOf('shuttle'), onTour: true };

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  sync = asAnyDb(db);
  finance = await addDepartment(db, 'Finance');
  personId = await addPerson(db, finance);
});

afterAll(async () => {
  await client.close();
});

async function parcelIn(status: 'depose' | 'retour_prepare') {
  const row = {
    ...parcelRow(),
    status,
    personId,
    departmentId: finance,
    depositedAt: new Date(),
    receivedBy: AGENT_ID,
    statusSeq: 0,
  };
  await db.insert(schema.parcel).values(row);
  return row;
}

const write = (
  { id, receivedAt, receivedBy }: Awaited<ReturnType<typeof parcelIn>>,
  status: string,
): SyncOp => ({
  opId: newId(),
  entity: 'parcel',
  entityId: id,
  type: 'upsert',
  patch: { status, statusSeq: 1, receivedAt, receivedBy },
  clientTs: new Date(),
});

describe('the steps of a return', () => {
  it('are not the shuttle’s to prepare', async () => {
    const row = await parcelIn('depose');
    const { results } = await push(sync, shuttle, {
      ops: [write(row, 'retour_prepare')],
    });
    expect(results[0]?.status).toBe(403);
  });

  it('are not the department’s to carry', async () => {
    const row = await parcelIn('retour_prepare');
    const { results } = await push(sync, accessOf('department', finance), {
      ops: [write(row, 'retour_en_route')],
    });
    expect(results[0]?.status).toBe(403);
  });

  it('let the shuttle take what waits for it', async () => {
    const row = await parcelIn('retour_prepare');
    const { results } = await push(sync, shuttle, {
      ops: [write(row, 'retour_en_route')],
    });
    expect(results[0]?.status).toBe(200);
  });

  it('stay hidden from an app of before', async () => {
    const { id } = await parcelIn('retour_prepare');
    const rowOf = async (returnStatuses?: true) =>
      (
        await pull(sync, accessOf('company_admin'), {
          cursor: null,
          page: null,
          limit: 500,
          departments: true,
          tourStatuses: true,
          returnStatuses,
        })
      ).rows.find((change) => change.row.id === id)?.row;
    expect((await rowOf())?.deletedAt).toBeInstanceOf(Date);
    expect((await rowOf(true))?.deletedAt).toBeNull();
  });
});
