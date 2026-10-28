import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase, LocalExtraction } from '#/features/db/schema';
import { addHandoverProof } from '#/features/handover/proofs';
import { savePhoto } from '#/features/photos/store';
import { LOCAL_PURGE_KEY, purgeLocal } from '#/features/retention/local-purge';
import {
  AFTER_SYNC_EVERY_MS,
  createLocalPurgeScheduler,
} from '#/features/retention/schedule';
import { handoverRow, openTestDatabase, parcelRow } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const NOW = new Date('2026-10-27T09:00:00Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

async function photoOf(
  parcelId: string | null,
  createdAt: Date,
  kind: 'etiquette' | 'signature' | 'dommage' = 'etiquette',
) {
  return savePhoto(
    db,
    files,
    {
      id: newId(),
      parcelId,
      kind,
      blob: new Blob(['photo'], { type: 'image/jpeg' }),
      width: 1600,
      height: 1200,
    },
    createdAt,
  );
}

function handedOver(days: number) {
  return parcelRow({
    status: 'remis',
    deliveredAt: daysAgo(days),
    deliveredBy: 'agent-1',
  });
}

const reading = (parcelId: string, createdAt: Date): LocalExtraction => ({
  parcelId,
  version: 1,
  fields: {},
  codes: [],
  ocrText: null,
  durations: { codesMs: null, ocrMs: null },
  provenance: 'device',
  createdAt,
});

describe('purgeLocal', () => {
  it('removes a photo 7 days after its parcel was handed over, not at 6 days', async () => {
    const old = handedOver(8);
    const recent = handedOver(6);
    const waiting = parcelRow();
    await db.parcel.bulkPut([old, recent, waiting]);
    const gone = await photoOf(old.id, daysAgo(20));
    const damage = await photoOf(old.id, daysAgo(20), 'dommage');
    const kept = await photoOf(recent.id, daysAgo(20));
    const still = await photoOf(waiting.id, daysAgo(60));

    const report = await purgeLocal(db, files, NOW);

    expect(report.photos).toBe(2);
    expect(await db.photo.get(gone.id)).toBeUndefined();
    expect(await db.photo.get(damage.id)).toBeUndefined();
    expect(files.files.has(`${gone.id}.jpg`)).toBe(false);
    expect(await db.photo.get(kept.id)).toBeDefined();
    expect(await db.photo.get(still.id)).toBeDefined();
  });

  it('keeps the photo while the server has not taken the parcel yet', async () => {
    const parcel = handedOver(8);
    await commitLocal(db, { upserts: [{ entity: 'parcel', row: parcel }] });
    const photo = await photoOf(parcel.id, daysAgo(20));

    await purgeLocal(db, files, NOW);

    expect(await db.photo.get(photo.id)).toBeDefined();
  });

  it('removes the photos of a parcel gone from the iPhone, not those of a batch in progress', async () => {
    const orphan = await photoOf(newId(), daysAgo(1));
    const draftId = newId();
    await db.draftParcel.put({
      id: draftId,
      batchId: newId(),
      createdAt: daysAgo(1),
      photoId: null,
      reading: 'read',
      carrier: null,
      tracking: null,
      trackingNorm: null,
      readName: null,
      symbols: [],
      ocrState: 'done',
      ocrName: null,
      ocrLines: [],
    });
    const drafted = await photoOf(draftId, daysAgo(1), 'dommage');
    const loose = await photoOf(null, daysAgo(90));

    await purgeLocal(db, files, NOW);

    expect(await db.photo.get(orphan.id)).toBeUndefined();
    expect(await db.photo.get(drafted.id)).toBeDefined();
    expect(await db.photo.get(loose.id)).toBeDefined();
  });

  it('keeps a signature 12 months', async () => {
    const parcel = handedOver(400);
    await db.parcel.put(parcel);
    const young = await photoOf(parcel.id, daysAgo(300), 'signature');
    const old = await photoOf(parcel.id, daysAgo(370), 'signature');

    await purgeLocal(db, files, NOW);

    expect(await db.photo.get(young.id)).toBeDefined();
    expect(await db.photo.get(old.id)).toBeUndefined();
  });

  it('forgets a label’s reading after 30 days, or once its parcel is gone', async () => {
    const parcel = parcelRow();
    const other = parcelRow();
    await db.parcel.bulkPut([parcel, other]);
    await db.extraction.bulkPut([
      reading(parcel.id, daysAgo(31)),
      reading(other.id, daysAgo(29)),
      reading(newId(), daysAgo(1)),
    ]);

    const report = await purgeLocal(db, files, NOW);

    expect(report.extractions).toBe(2);
    expect(await db.extraction.toCollection().primaryKeys()).toEqual([
      other.id,
    ]);
    expect((await db.syncState.get(LOCAL_PURGE_KEY))?.value).toEqual(report);
  });
});

describe('purgeLocal, handover proofs', () => {
  const proof = (kind: 'signature' | 'photo') => ({
    kind,
    blob: new Blob([kind], {
      type: kind === 'photo' ? 'image/jpeg' : 'image/png',
    }),
    width: 10,
    height: 10,
  });
  const keep = async (
    handoverId: string,
    kind: 'signature' | 'photo',
    at: Date,
  ) => addHandoverProof(db, files, handoverId, proof(kind), { now: at });

  it('keeps a signature 12 months after it was drawn, a photo 7 days after the handover', async () => {
    const old = handoverRow({ at: daysAgo(370) });
    const week = handoverRow({ at: daysAgo(8) });
    const recent = handoverRow({ at: daysAgo(6) });
    await db.handover.bulkPut([old, week, recent]);
    const oldSignature = await keep(old.id, 'signature', daysAgo(370));
    const weekSignature = await keep(week.id, 'signature', daysAgo(8));
    const weekPhoto = await keep(week.id, 'photo', daysAgo(8));
    const recentPhoto = await keep(recent.id, 'photo', daysAgo(6));
    await db.outbox.clear();

    const report = await purgeLocal(db, files, NOW);

    expect(report.proofs).toBe(2);
    const left = (await db.handoverProof.toArray()).map((row) => row.id);
    expect(left.sort()).toEqual([weekSignature.id, recentPhoto.id].sort());
    expect(files.files.has(`${oldSignature.id}.png`)).toBe(false);
    expect(files.files.has(`${weekPhoto.id}.jpg`)).toBe(false);
  });

  it('keeps the photo while the server has not taken the handover yet', async () => {
    const handover = handoverRow({ at: daysAgo(10) });
    await db.handover.put(handover);
    const photo = await keep(handover.id, 'photo', daysAgo(10));

    await purgeLocal(db, files, NOW);

    expect(await db.handoverProof.get(photo.id)).toBeDefined();
  });

  it('keeps a proof without its handover yet, for the time the handover is written', async () => {
    const signature = await files.save('x.png', new Blob(['x'])).then(() =>
      db.handoverProof.put({
        id: 'young',
        handoverId: 'being-written',
        kind: 'signature',
        path: 'photos/young.png',
        width: 1,
        height: 1,
        bytes: 1,
        createdAt: new Date(NOW.getTime() - 10 * 60 * 1000),
      }),
    );

    await purgeLocal(db, files, NOW);

    expect(await db.handoverProof.get(signature)).toBeDefined();
  });

  it('removes a proof whose handover left the iPhone, after the grace', async () => {
    const handover = handoverRow({ at: daysAgo(1) });
    await db.handover.put(handover);
    const signature = await keep(handover.id, 'signature', daysAgo(1));
    await db.handover.delete(handover.id);

    await purgeLocal(db, files, NOW);

    expect(await db.handoverProof.get(signature.id)).toBeUndefined();
  });
});

describe('local purge scheduler', () => {
  it('runs at launch, then after a sync at most every 15 minutes', async () => {
    let clock = NOW.getTime();
    const idle = vi.fn((work: () => void) => work());
    const scheduler = createLocalPurgeScheduler({
      db,
      files: () => files,
      idle,
      now: () => new Date(clock),
    });

    await expect(scheduler.schedule({ force: true })).resolves.toMatchObject({
      photos: 0,
    });
    await expect(scheduler.schedule()).resolves.toBeNull();
    clock += AFTER_SYNC_EVERY_MS;
    await expect(scheduler.schedule()).resolves.not.toBeNull();
    expect(idle).toHaveBeenCalledTimes(2);
  });
});
