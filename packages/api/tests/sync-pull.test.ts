import type { AnyDb } from '@repo/db';
import type { PGlite } from '@electric-sql/pglite';
import { SYNCED_ENTITIES, type PullOutput } from '@repo/contract/sync';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EVENT_HORIZON_DAYS, pull } from '#features/sync/pull';
import {
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let sync: AnyDb;

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  sync = asAnyDb(db);
});

afterAll(async () => {
  await client.close();
});

const ids = (output: PullOutput) => output.rows.map((change) => change.row.id);

async function fullPull(cursor: PullOutput['cursor'] | null, limit = 50) {
  const pages: PullOutput[] = [];
  let first = await pull(sync, ORGANIZATION_ID, {
    cursor:
      cursor === null ? null : { generation: await generation(), xid: cursor },
    page: null,
    limit,
  });
  pages.push(first);
  while (first.next) {
    first = await pull(sync, ORGANIZATION_ID, {
      cursor: null,
      page: first.next,
      limit,
    });
    pages.push(first);
  }
  return pages;
}

async function generation() {
  const [row] = await db.select().from(schema.syncGeneration);
  return row?.generation ?? '';
}

async function clearParcels() {
  await db.delete(schema.parcel);
  await db.delete(schema.contact);
}

describe('sync.pull', () => {
  it('returns the rows of the caller’s mailroom only, without the organization', async () => {
    await clearParcels();
    const mine = parcelRow();
    const theirs = parcelRow(OTHER_ORGANIZATION_ID);
    await db.insert(schema.parcel).values([mine, theirs]);

    const [output] = await fullPull(null);

    expect(ids(output!)).toEqual([mine.id]);
    expect(output!.rows[0]?.row).not.toHaveProperty('organizationId');
    expect(output!.rows[0]?.row).toMatchObject({
      status: 'recu',
      receivedAt: mine.receivedAt,
    });
    expect(output!.reset).toBe(false);
    expect(output!.next).toBeNull();
  });

  it('skips what the cursor already covers, and moves the cursor past it', async () => {
    await clearParcels();
    const earlier = parcelRow();
    await db.insert(schema.parcel).values(earlier);
    const [first] = await fullPull(null);
    const later = parcelRow();
    await db.insert(schema.parcel).values(later);

    const [second] = await fullPull(first!.cursor);

    expect(ids(first!)).toEqual([earlier.id]);
    expect(ids(second!)).toEqual([later.id]);
    expect(second!.cursor).toBeGreaterThan(first!.cursor);
    expect(second!.reset).toBe(false);
  });

  it('pages in (server_xid, id) order under one fixed bound', async () => {
    await clearParcels();
    const rows = [parcelRow(), parcelRow(), parcelRow()];
    for (const row of rows) await db.insert(schema.parcel).values(row);
    const contact = {
      id: newId(),
      organizationId: ORGANIZATION_ID,
      name: 'Livreur',
      nameNorm: 'livreur',
    };
    await db.insert(schema.contact).values(contact);

    const pages = await fullPull(null, 2);

    expect(pages.map((page) => page.rows.length)).toEqual([2, 2]);
    expect(pages[0]!.next).toMatchObject({
      bound: pages[0]!.cursor,
      entity: SYNCED_ENTITIES.indexOf('parcel'),
    });
    expect(pages[1]!.cursor).toBe(pages[0]!.cursor);
    const seen = pages.flatMap((page) =>
      page.rows.map((change) => `${change.entity}:${change.row.id}`),
    );
    expect(seen).toEqual([
      `contact:${contact.id}`,
      ...rows.map((row) => `parcel:${row.id}`),
    ]);
    await db.delete(schema.contact).where(eq(schema.contact.id, contact.id));
  });

  it('keeps paging when a page fills up exactly at the end of an entity', async () => {
    await clearParcels();
    const contact = {
      id: newId(),
      organizationId: ORGANIZATION_ID,
      name: 'Coursier',
      nameNorm: 'coursier',
    };
    await db.insert(schema.contact).values(contact);
    const rows = [parcelRow(), parcelRow(), parcelRow()];
    for (const row of rows) await db.insert(schema.parcel).values(row);

    const pages = await fullPull(null, 1);

    expect(pages.map((page) => page.rows.length)).toEqual([1, 1, 1, 1]);
    expect(pages[0]!.rows[0]?.entity).toBe('contact');
    expect(pages.flatMap((page) => ids(page))).toEqual([
      contact.id,
      ...rows.map((row) => row.id),
    ]);
    await db.delete(schema.contact).where(eq(schema.contact.id, contact.id));
  });

  it('starts over when the cursor comes from another generation', async () => {
    await clearParcels();
    const row = parcelRow();
    await db.insert(schema.parcel).values(row);
    const [current] = await fullPull(null);

    const output = await pull(sync, ORGANIZATION_ID, {
      cursor: { generation: newId(), xid: current!.cursor },
      page: null,
      limit: 50,
    });

    expect(output.reset).toBe(true);
    expect(ids(output)).toEqual([row.id]);
  });

  it('starts over when the cursor is beyond the server’s counter', async () => {
    await clearParcels();
    const row = parcelRow();
    await db.insert(schema.parcel).values(row);
    const [current] = await fullPull(null);

    const output = await pull(sync, ORGANIZATION_ID, {
      cursor: {
        generation: await generation(),
        xid: current!.cursor + 1_000_000,
      },
      page: null,
      limit: 50,
    });

    expect(output.reset).toBe(true);
    expect(ids(output)).toEqual([row.id]);
  });

  it('sees a restore as a new generation', async () => {
    await clearParcels();
    const [before] = await fullPull(null);
    await db
      .update(schema.syncGeneration)
      .set({ generation: sql`gen_random_uuid()` });

    const output = await pull(sync, ORGANIZATION_ID, {
      cursor: { generation: before!.generation, xid: before!.cursor },
      page: null,
      limit: 50,
    });

    expect(output.generation).not.toBe(before!.generation);
    expect(output.reset).toBe(true);
  });
  it('skips the old events on a pull from zero, never on a pull from a cursor', async () => {
    await clearParcels();
    await db.delete(schema.event);
    const now = new Date('2026-10-24T10:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    const eventRow = (at: Date) => ({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      entity: 'parcel',
      entityId: newId(),
      type: 'recu',
      at,
    });
    const old = eventRow(
      new Date(now.getTime() - (EVENT_HORIZON_DAYS + 30) * day),
    );
    const recent = eventRow(new Date(now.getTime() - 2 * day));
    await db.insert(schema.event).values([old, recent]);

    const first = await pull(
      sync,
      ORGANIZATION_ID,
      { cursor: null, page: null, limit: 50 },
      now,
    );
    const older = eventRow(new Date(now.getTime() - 400 * day));
    await db.insert(schema.event).values(older);
    const second = await pull(
      sync,
      ORGANIZATION_ID,
      {
        cursor: { generation: await generation(), xid: first.cursor },
        page: null,
        limit: 50,
      },
      now,
    );

    expect(ids(first)).toEqual([recent.id]);
    expect(ids(second)).toEqual([older.id]);
  });
});
