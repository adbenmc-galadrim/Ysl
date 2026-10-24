import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDraft,
  countDrafts,
  currentBatch,
  discardBatch,
  finishBatch,
  openBatch,
  promotedStatus,
  typedDraft,
  addTypedDraft,
  undoLast,
  updateDraft,
} from '#/features/batch/store';
import type { CourrierDatabase, DraftParcel } from '#/features/db/schema';
import { NOW, openTestDatabase } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const photo = () => ({
  blob: new Blob(['etiquette'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

const draft = (overrides: Partial<DraftParcel>): DraftParcel => ({
  id: 'd',
  batchId: 'b',
  createdAt: NOW,
  photoId: null,
  reading: 'read',
  carrier: null,
  tracking: null,
  trackingNorm: null,
  readName: null,
  symbols: [],
  ocrState: 'pending',
  ocrName: null,
  ocrLines: [],
  ...overrides,
});

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

describe('openBatch', () => {
  it('picks the open batch up instead of starting a second one', async () => {
    const first = await openBatch(db, NOW);
    const again = await openBatch(db, later(60));
    expect(again.id).toBe(first.id);
    expect(await db.draftBatch.count()).toBe(1);
    expect((await currentBatch(db))?.id).toBe(first.id);
  });
});

describe('typedDraft', () => {
  const typed = {
    carrier: 'UPS',
    tracking: '1ZE6344W0499230622',
    trackingNorm: '1ZE6344W0499230622',
  };

  it('writes a settled draft without a photo, counted in the batch', async () => {
    const batch = await openBatch(db, NOW);
    const draft = typedDraft(batch.id, typed, NOW);
    await addTypedDraft(db, draft);
    expect(draft).toMatchObject({
      batchId: batch.id,
      reading: 'typed',
      photoId: null,
      ...typed,
    });
    expect(await db.draftParcel.get(draft.id)).toEqual(draft);
    expect(await countDrafts(db, batch.id)).toBe(1);
  });

  it('promotes it without a photo, to complete, number kept', async () => {
    const batch = await openBatch(db, NOW);
    await addTypedDraft(db, typedDraft(batch.id, typed, NOW));
    const [id] = await finishBatch(db, {
      batchId: batch.id,
      agentId: 'agent',
      now: later(10),
    });
    expect(await db.parcel.get(id!)).toMatchObject({
      status: 'a_completer',
      ...typed,
    });
    expect(await db.photo.count()).toBe(0);
    expect(await db.photo.where('parcelId').equals(id!).count()).toBe(0);
    expect(await db.draftParcel.count()).toBe(0);
  });

  it('fills an unread draft in place, photo kept', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, draft.id, { reading: 'unreadable' });
    expect(
      await updateDraft(db, draft.id, { reading: 'typed', ...typed }),
    ).toBe(true);
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      reading: 'typed',
      photoId: draft.photoId,
      ...typed,
    });
    expect(await countDrafts(db, batch.id)).toBe(1);
  });
});

describe('addDraft', () => {
  it('writes the photo, then a pending draft that points at it', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    expect(draft).toMatchObject({ batchId: batch.id, reading: 'pending' });
    expect(files.files.has(`${draft.photoId}.jpg`)).toBe(true);
    expect(await db.photo.get(draft.photoId ?? '')).toMatchObject({
      parcelId: null,
      kind: 'etiquette',
    });
  });

  it('writes no draft when the photo could not be stored', async () => {
    const batch = await openBatch(db, NOW);
    files.failNextSave = true;
    await expect(addDraft(db, files, batch.id, photo(), NOW)).rejects.toThrow();
    expect(await db.draftParcel.count()).toBe(0);
    expect(await db.photo.count()).toBe(0);
  });
});

describe('undoLast', () => {
  it('removes the last draft and its photo, and only those', async () => {
    const batch = await openBatch(db, NOW);
    const kept = await addDraft(db, files, batch.id, photo(), NOW);
    const undone = await addDraft(db, files, batch.id, photo(), later(1));

    const removed = await undoLast(db, files, batch.id);

    expect(removed?.id).toBe(undone.id);
    expect(await db.draftParcel.toArray()).toMatchObject([{ id: kept.id }]);
    expect(files.files.has(`${undone.photoId}.jpg`)).toBe(false);
    expect(files.files.has(`${kept.photoId}.jpg`)).toBe(true);
    expect(await db.photo.count()).toBe(1);
  });
});

describe('discardBatch', () => {
  it('removes the batch, its drafts and their photos', async () => {
    const batch = await openBatch(db, NOW);
    const first = await addDraft(db, files, batch.id, photo(), NOW);
    await addTypedDraft(
      db,
      typedDraft(batch.id, {
        carrier: 'UPS',
        tracking: '1Z999AA10123456784',
        trackingNorm: '1Z999AA10123456784',
      }),
    );
    const third = await addDraft(db, files, batch.id, photo(), later(2));

    await discardBatch(db, files, batch.id);

    expect(await currentBatch(db)).toBeUndefined();
    expect(await db.draftParcel.count()).toBe(0);
    expect(await db.photo.count()).toBe(0);
    expect(files.files.has(`${first.photoId}.jpg`)).toBe(false);
    expect(files.files.has(`${third.photoId}.jpg`)).toBe(false);
    expect((await openBatch(db, later(60))).id).not.toBe(batch.id);
  });
});

describe('promotedStatus', () => {
  it('needs a carrier, a number and a name to count as received', () => {
    const full = { carrier: 'UPS', tracking: '1Z', readName: 'Camille Morel' };
    expect(promotedStatus(draft(full))).toBe('recu');
    expect(promotedStatus(draft({ ...full, tracking: null }))).toBe(
      'a_completer',
    );
    expect(promotedStatus(draft({ ...full, carrier: null }))).toBe(
      'a_completer',
    );
    expect(promotedStatus(draft({ ...full, readName: null }))).toBe(
      'a_completer',
    );
  });

  it('does not trust the name the OCR guessed', () => {
    expect(
      promotedStatus(
        draft({ carrier: 'UPS', tracking: '1Z', ocrName: 'Camille Morel' }),
      ),
    ).toBe('a_completer');
  });
});

describe('finishBatch', () => {
  it('turns the drafts into a batch and its parcels, queued, photos attached', async () => {
    const batch = await openBatch(db, NOW);
    const read = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, read.id, {
      reading: 'read',
      carrier: 'UPS',
      tracking: '1ZE6344W0499230622',
      trackingNorm: '1ZE6344W0499230622',
      readName: 'Camille Morel',
    });
    const unnamed = await addDraft(db, files, batch.id, photo(), later(1));
    await updateDraft(db, unnamed.id, {
      reading: 'read',
      carrier: 'UPS',
      tracking: '1ZE6344W0499230622',
      trackingNorm: '1ZE6344W0499230622',
    });
    const blank = await addDraft(db, files, batch.id, photo(), later(2));
    await updateDraft(db, blank.id, { reading: 'unreadable' });
    const end = later(90);

    const ids = await finishBatch(db, {
      batchId: batch.id,
      agentId: 'agent-1',
      now: end,
    });

    expect(ids).toEqual([read.id, unnamed.id, blank.id]);
    expect(await db.batch.get(batch.id)).toMatchObject({
      agentId: 'agent-1',
      startedAt: NOW,
      endedAt: end,
      parcelCount: 3,
    });
    expect(await db.parcel.get(read.id)).toMatchObject({
      batchId: batch.id,
      status: 'recu',
      carrier: 'UPS',
      receivedAt: NOW,
      receivedBy: 'agent-1',
    });
    expect(await db.parcel.get(unnamed.id)).toMatchObject({
      status: 'a_completer',
      carrier: 'UPS',
      readName: null,
    });
    expect(await db.parcel.get(blank.id)).toMatchObject({
      status: 'a_completer',
      carrier: null,
    });
    expect(await db.photo.get(read.photoId ?? '')).toMatchObject({
      parcelId: read.id,
    });
    const queued = await db.outbox.toArray();
    expect(queued.map((op) => op.entity).sort()).toEqual([
      'batch',
      'parcel',
      'parcel',
      'parcel',
    ]);
    expect(await db.draftParcel.count()).toBe(0);
    expect(await currentBatch(db)).toBeUndefined();
  });

  it('leaves nothing behind for an empty batch', async () => {
    const batch = await openBatch(db, NOW);
    const ids = await finishBatch(db, { batchId: batch.id, agentId: 'a' });
    expect(ids).toEqual([]);
    expect(await db.batch.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect(await currentBatch(db)).toBeUndefined();
  });
});
