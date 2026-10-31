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
      departments: true,
      tourStatuses: true,
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
      {
        cursor: { generation: GENERATION, xid: 300 },
        page: null,
        limit: 1,
        departments: true,
        tourStatuses: true,
      },
      {
        cursor: null,
        page: token,
        limit: 1,
        departments: true,
        tourStatuses: true,
      },
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

  it('drops a row the server marked deleted, with its parcel’s events and reading', async () => {
    const parcel = parcelRow();
    await db.parcel.put(parcel);
    await db.event.put({
      id: newId(),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      entity: 'parcel',
      entityId: parcel.id,
      type: 'parcel.status',
      actorId: null,
      at: NOW,
      detail: null,
    });
    await db.extraction.put({
      parcelId: parcel.id,
      version: 1,
      fields: {},
      codes: [],
      ocrText: 'MORE CAMILLE',
      durations: { codesMs: null, ocrMs: null },
      provenance: 'device',
      createdAt: NOW,
    });
    const client = vi.fn().mockResolvedValue(
      page([
        {
          entity: 'parcel',
          row: serverRow({ ...parcel, deletedAt: NOW }, 420),
        },
      ]),
    );

    await pullChanges(db, client);

    expect(await db.parcel.get(parcel.id)).toBeUndefined();
    expect(await db.event.count()).toBe(0);
    expect(await db.extraction.count()).toBe(0);
  });

  it('keeps a row marked deleted on the server while this device has a change of it to send', async () => {
    const parcel = parcelRow({ notes: 'à envoyer' });
    await commitLocal(db, { upserts: [{ entity: 'parcel', row: parcel }] });
    const client = vi.fn().mockResolvedValue(
      page([
        {
          entity: 'parcel',
          row: serverRow({ ...parcel, deletedAt: NOW }, 420),
        },
      ]),
    );

    await pullChanges(db, client);

    expect((await db.parcel.get(parcel.id))?.notes).toBe('à envoyer');
  });

  it('after a reset, drops what the full read did not bring back, except what is still to send', async () => {
    await db.syncState.put({
      key: SYNC_STATE_KEYS.cursor,
      value: { generation: GENERATION, xid: 3 },
    });
    const erased = parcelRow();
    const kept = parcelRow();
    const unsent = parcelRow();
    await db.parcel.bulkPut([erased, kept]);
    await commitLocal(db, { upserts: [{ entity: 'parcel', row: unsent }] });
    const client = vi
      .fn()
      .mockResolvedValueOnce(
        page([{ entity: 'directory_person', row: serverRow(personRow(), 5) }], {
          reset: true,
          next: { from: 0, bound: 20, entity: 5, after: null },
        }),
      )
      .mockResolvedValueOnce(
        page([{ entity: 'parcel', row: serverRow(kept, 6) }], { cursor: 20 }),
      )
      .mockResolvedValueOnce(page([], { cursor: 25 }));

    const outcome = await pullChanges(db, client);

    expect(client).toHaveBeenLastCalledWith({
      cursor: { generation: GENERATION, xid: 20 },
      page: null,
      limit: 200,
      departments: true,
      tourStatuses: true,
    });
    expect(outcome.cursor).toEqual({ generation: GENERATION, xid: 25 });
    expect(await db.parcel.get(erased.id)).toBeUndefined();
    expect(await db.parcel.get(kept.id)).toBeDefined();
    expect(await db.parcel.get(unsent.id)).toBeDefined();
    expect(await db.directoryPerson.count()).toBe(1);
  });

  it('after a reset, keeps a row rewritten during the full read, which the second read brings', async () => {
    await db.syncState.put({
      key: SYNC_STATE_KEYS.cursor,
      value: { generation: GENERATION, xid: 3 },
    });
    const rewritten = parcelRow();
    await db.parcel.put(rewritten);
    const client = vi
      .fn()
      .mockResolvedValueOnce(page([], { reset: true, cursor: 20 }))
      .mockResolvedValueOnce(
        page([{ entity: 'parcel', row: serverRow(rewritten, 21) }], {
          cursor: 30,
        }),
      );

    await pullChanges(db, client);

    expect(await db.parcel.get(rewritten.id)).toBeDefined();
  });

  it('starts the count over when a later page says the read restarted from zero', async () => {
    await db.syncState.put({
      key: SYNC_STATE_KEYS.cursor,
      value: { generation: GENERATION, xid: 300 },
    });
    const stale = parcelRow();
    const live = parcelRow();
    await db.parcel.bulkPut([stale, live]);
    const client = vi
      .fn()
      .mockResolvedValueOnce(
        page([{ entity: 'parcel', row: serverRow(stale, 310) }], {
          next: { from: 300, bound: 500, entity: 5, after: null },
        }),
      )
      .mockResolvedValueOnce(
        page([{ entity: 'parcel', row: serverRow(live, 12) }], {
          reset: true,
          cursor: 500,
        }),
      )
      .mockResolvedValueOnce(page([], { cursor: 510 }));

    const outcome = await pullChanges(db, client);

    expect(outcome.reset).toBe(true);
    expect(await db.parcel.get(live.id)).toBeDefined();
    expect(await db.parcel.get(stale.id)).toBeUndefined();
  });

  it('after a reset, keeps a row whose change the server refused', async () => {
    await db.syncState.put({
      key: SYNC_STATE_KEYS.cursor,
      value: { generation: GENERATION, xid: 3 },
    });
    const refused = parcelRow();
    await commitLocal(db, { upserts: [{ entity: 'parcel', row: refused }] });
    await db.outbox.toCollection().modify({ state: 'rejected' });
    const client = vi
      .fn()
      .mockResolvedValueOnce(page([], { reset: true, cursor: 20 }))
      .mockResolvedValueOnce(page([], { cursor: 20 }));

    await pullChanges(db, client);

    expect(await db.parcel.get(refused.id)).toBeDefined();
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
