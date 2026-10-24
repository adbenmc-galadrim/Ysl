import 'fake-indexeddb/auto';
import type { PullInput, PullOutput } from '@repo/contract/sync';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import { SYNC_STATE_KEYS, type CourrierDatabase } from '#/features/db/schema';
import { pullChanges, readCursor } from '#/features/sync/pull';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

let db: CourrierDatabase;

const GENERATION = newId();

beforeEach(async () => {
  db = await openTestDatabase();
});

const page = (
  rows: PullOutput['rows'],
  overrides: Partial<PullOutput> = {},
): PullOutput => ({
  generation: GENERATION,
  reset: false,
  rows,
  next: null,
  cursor: 500,
  ...overrides,
});

const serverRow = <Row extends { id: string }>(
  row: Row,
  serverXid: number,
) => ({
  ...row,
  serverXid,
});

describe('pullChanges', () => {
  it('writes each row in its table and moves the cursor', async () => {
    const parcel = serverRow(parcelRow({ notes: 'du serveur' }), 410);
    const person = serverRow(personRow(), 411);
    const client = vi.fn().mockResolvedValue(
      page([
        { entity: 'directory_person', row: person },
        { entity: 'parcel', row: parcel },
      ]),
    );

    const outcome = await pullChanges(db, client);

    expect(outcome).toEqual({
      rows: 2,
      reset: false,
      cursor: { generation: GENERATION, xid: 500 },
    });
    expect(client).toHaveBeenCalledWith({
      cursor: null,
      page: null,
      limit: 200,
    });
    expect(await db.parcel.get(parcel.id)).toMatchObject({
      notes: 'du serveur',
      serverXid: 410,
      receivedAt: parcel.receivedAt,
    });
    expect(await db.directoryPerson.get(person.id)).toMatchObject({
      email: person.email,
    });
    expect(await readCursor(db)).toEqual({ generation: GENERATION, xid: 500 });
  });

  it('sends the cursor it holds, then the page tokens, and commits the cursor last', async () => {
    await db.syncState.put({
      key: SYNC_STATE_KEYS.cursor,
      value: { generation: GENERATION, xid: 300 },
    });
    const first = serverRow(parcelRow(), 350);
    const second = serverRow(parcelRow(), 360);
    const token = {
      from: 300,
      bound: 400,
      entity: 5,
      after: { xid: 350, id: first.id },
    };
    const cursorsSeen: unknown[] = [];
    const client = vi.fn(async (input: PullInput) => {
      cursorsSeen.push(await readCursor(db));
      return input.page
        ? page([{ entity: 'parcel', row: second }], { cursor: 400 })
        : page([{ entity: 'parcel', row: first }], {
            next: token,
            cursor: 400,
          });
    });

    const outcome = await pullChanges(db, client, { limit: 1 });

    expect(client.mock.calls.map(([input]) => input)).toEqual([
      { cursor: { generation: GENERATION, xid: 300 }, page: null, limit: 1 },
      { cursor: null, page: token, limit: 1 },
    ]);
    expect(cursorsSeen).toEqual([
      { generation: GENERATION, xid: 300 },
      { generation: GENERATION, xid: 300 },
    ]);
    expect(outcome.cursor).toEqual({ generation: GENERATION, xid: 400 });
    expect(await db.parcel.count()).toBe(2);
  });

  it('leaves a row this device still has to send', async () => {
    const mine = parcelRow({ notes: 'à envoyer' });
    await commitLocal(
      db,
      { upserts: [{ entity: 'parcel', row: mine }] },
      { now: NOW },
    );
    const other = parcelRow();
    const client = vi.fn().mockResolvedValue(
      page([
        {
          entity: 'parcel',
          row: serverRow({ ...mine, notes: 'ancienne' }, 420),
        },
        { entity: 'parcel', row: serverRow(other, 421) },
      ]),
    );

    const outcome = await pullChanges(db, client);

    expect(outcome.rows).toBe(1);
    expect((await db.parcel.get(mine.id))?.notes).toBe('à envoyer');
    expect(await db.parcel.get(other.id)).toBeDefined();
  });

  it('takes a full read again when the server resets the cursor', async () => {
    await db.syncState.put({
      key: SYNC_STATE_KEYS.cursor,
      value: { generation: newId(), xid: 9_000 },
    });
    const row = serverRow(parcelRow(), 12);
    const client = vi
      .fn()
      .mockResolvedValue(
        page([{ entity: 'parcel', row }], { reset: true, cursor: 20 }),
      );

    const outcome = await pullChanges(db, client);

    expect(outcome).toMatchObject({
      reset: true,
      cursor: { generation: GENERATION, xid: 20 },
    });
    expect(await db.parcel.get(row.id)).toBeDefined();
  });

  it('keeps the old cursor when a page fails', async () => {
    await db.syncState.put({
      key: SYNC_STATE_KEYS.cursor,
      value: { generation: GENERATION, xid: 300 },
    });
    const client = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(pullChanges(db, client)).rejects.toThrow('Failed to fetch');
    expect(await readCursor(db)).toEqual({ generation: GENERATION, xid: 300 });
  });
  it('reports the rows written after each page', async () => {
    const first = page(
      [{ entity: 'parcel', row: serverRow(parcelRow(), 410) }],
      {
        next: { from: 0, bound: 500, entity: 5, after: null },
      },
    );
    const second = page([
      { entity: 'parcel', row: serverRow(parcelRow(), 411) },
      { entity: 'parcel', row: serverRow(parcelRow(), 412) },
    ]);
    const client = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const seen: number[] = [];

    await pullChanges(db, client, { onProgress: (rows) => seen.push(rows) });

    expect(seen).toEqual([1, 3]);
  });
});
