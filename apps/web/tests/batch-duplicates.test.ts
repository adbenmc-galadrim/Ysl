import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  dropHeld,
  findDuplicate,
  holdDraft,
  restoreDraft,
} from '#/features/batch/duplicates';
import { addDraft, countDrafts, openBatch } from '#/features/batch/store';
import type { CourrierDatabase, DraftParcel } from '#/features/db/schema';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const UPS = '1ZE6344W0499230622';

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

const draft = (overrides: Partial<DraftParcel>): DraftParcel => ({
  id: 'd',
  batchId: 'b',
  createdAt: NOW,
  photoId: null,
  reading: 'read',
  carrier: 'UPS',
  tracking: UPS,
  trackingNorm: UPS,
  readName: null,
  symbols: [],
  ocrState: 'skipped',
  ocrName: null,
  ocrLines: [],
  ...overrides,
});

const photo = () => ({
  blob: new Blob(['etiquette'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('findDuplicate', () => {
  const pieces = (index: number, read: number[] = [index]) => ({
    total: 3,
    read,
    key: 'ups:SHIP42',
    photoIds: [],
  });

  it('takes the next piece of a parcel of the batch for what it is, not a duplicate', async () => {
    await db.draftParcel.add(
      draft({ id: 'first', createdAt: NOW, pieces: pieces(1) }),
    );
    const next = {
      ...draft({ id: 'next', createdAt: later(10) }),
      piece: { index: 2, total: 3, key: 'ups:SHIP42' },
    };

    await expect(findDuplicate(db, next)).resolves.toBeNull();
  });

  it('finds the parcel a piece already read belongs to', async () => {
    await db.draftParcel.add(
      draft({ id: 'first', createdAt: NOW, pieces: pieces(1, [1, 2]) }),
    );
    const again = {
      ...draft({ id: 'again', createdAt: later(10), trackingNorm: 'OTHER' }),
      piece: { index: 2, total: 3, key: 'ups:SHIP42' },
    };

    await expect(findDuplicate(db, again)).resolves.toMatchObject({
      kind: 'batch',
      draft: { id: 'first' },
    });
  });

  it('holds the same number read again to be a duplicate when one side has no pieces', async () => {
    await db.draftParcel.add(draft({ id: 'first', createdAt: NOW }));
    const piece = {
      ...draft({ id: 'piece', createdAt: later(10) }),
      piece: { index: 2, total: 3, key: 'ups:SHIP42' },
    };

    await expect(findDuplicate(db, piece)).resolves.toMatchObject({
      kind: 'batch',
      draft: { id: 'first' },
    });
  });

  it('finds the older draft of the batch that bears the same number, however written', async () => {
    await db.draftParcel.add(
      draft({
        id: 'first',
        createdAt: NOW,
        tracking: '1z e634-4w04 9923 0622',
      }),
    );
    const second = draft({ id: 'second', createdAt: later(10) });

    await expect(findDuplicate(db, second)).resolves.toMatchObject({
      kind: 'batch',
      draft: { id: 'first' },
    });
  });

  it('never takes a draft for its own duplicate', async () => {
    const only = draft({ id: 'only' });
    await db.draftParcel.add(only);

    await expect(findDuplicate(db, only)).resolves.toBeNull();
  });

  it('leaves a younger draft alone: the later reading is the duplicate', async () => {
    await db.draftParcel.add(draft({ id: 'younger', createdAt: later(10) }));
    const older = draft({ id: 'older', createdAt: NOW });

    await expect(findDuplicate(db, older)).resolves.toBeNull();
  });

  it('ignores a draft of another batch', async () => {
    await db.draftParcel.add(draft({ id: 'elsewhere', batchId: 'old' }));

    await expect(
      findDuplicate(db, draft({ id: 'here', createdAt: later(10) })),
    ).resolves.toBeNull();
  });

  it('finds the latest parcel received with that number, deleted ones aside', async () => {
    await db.parcel.bulkAdd([
      parcelRow({ id: 'early', receivedAt: new Date(2026, 9, 20, 9, 0) }),
      parcelRow({ id: 'late', receivedAt: new Date(2026, 9, 23, 10, 42) }),
      parcelRow({
        id: 'gone',
        receivedAt: new Date(2026, 9, 24, 8, 0),
        deletedAt: NOW,
      }),
    ]);

    await expect(findDuplicate(db, draft({}))).resolves.toMatchObject({
      kind: 'parcel',
      parcel: { id: 'late' },
    });
  });

  it('prefers the draft of this batch to a parcel received before', async () => {
    await db.parcel.add(parcelRow({ id: 'before' }));
    await db.draftParcel.add(draft({ id: 'first', createdAt: NOW }));

    await expect(
      findDuplicate(db, draft({ id: 'second', createdAt: later(10) })),
    ).resolves.toMatchObject({ kind: 'batch', draft: { id: 'first' } });
  });

  it('matches on the normalized number, whatever the label printed', async () => {
    await db.parcel.add(
      parcelRow({ id: 'typed', tracking: '1z e634-4w04 9923 0622' }),
    );

    await expect(findDuplicate(db, draft({}))).resolves.toMatchObject({
      kind: 'parcel',
      parcel: { id: 'typed' },
    });
  });

  it('has no duplicate for a draft without a number', async () => {
    await db.draftParcel.add(draft({ id: 'unread', trackingNorm: null }));

    await expect(
      findDuplicate(db, draft({ id: 'blank', trackingNorm: null })),
    ).resolves.toBeNull();
  });
});

describe('holdDraft, restoreDraft, dropHeld', () => {
  it('takes the draft out of the batch and keeps its photo for a comeback', async () => {
    const files = new MemoryFiles();
    const batch = await openBatch(db, NOW);
    const added = await addDraft(db, files, batch.id, photo(), NOW);

    const held = await holdDraft(db, added.id);

    expect(held?.id).toBe(added.id);
    expect(await countDrafts(db, batch.id)).toBe(0);
    expect(await db.photo.get(added.photoId!)).toBeDefined();
    expect([...files.files.keys()]).toEqual([`${added.photoId}.jpg`]);

    await restoreDraft(db, held!);

    expect(await countDrafts(db, batch.id)).toBe(1);
    expect(await db.draftParcel.get(added.id)).toMatchObject({
      photoId: added.photoId,
    });
  });

  it('says so when the draft was undone meanwhile', async () => {
    await expect(holdDraft(db, 'gone')).resolves.toBeUndefined();
  });

  it('drops the photo of a held draft given up', async () => {
    const files = new MemoryFiles();
    const batch = await openBatch(db, NOW);
    const added = await addDraft(db, files, batch.id, photo(), NOW);
    const held = (await holdDraft(db, added.id))!;

    await dropHeld(db, files, held);

    expect(await db.photo.get(added.photoId!)).toBeUndefined();
    expect(files.files.size).toBe(0);
  });
});
