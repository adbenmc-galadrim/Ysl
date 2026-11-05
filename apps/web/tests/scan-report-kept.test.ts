import 'fake-indexeddb/auto';
import { scanReportV1 } from '@repo/contract/scan-report';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CourrierDatabase,
  DraftParcel,
  LocalExtraction,
} from '#/features/db/schema';
import { savePhoto } from '#/features/photos/store';
import {
  buildKeptReport,
  keptImage,
  type KeptReading,
  keptReason,
  loadKept,
  queueKeptReport,
} from '#/features/scan-report/kept';
import { deviceOf } from '#/features/scan-report/report';
import { draftOf, line } from './helpers/drafts';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

/** A synthetic UPS label: the 1Z key is computed, nothing comes from a real parcel. */
const TRACKING = '1Z999AA10123456784';
const DAY = 24 * 60 * 60 * 1000;

const CONTEXT = {
  app: { version: '2026.11.05', build: '2026-11-05T08:00:00.000Z' },
  device: deviceOf(
    {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)',
      platform: 'iPhone',
      language: 'fr-FR',
      maxTouchPoints: 5,
    },
    { width: 420, height: 912, pixelRatio: 3 },
    true,
  ),
  now: NOW,
  reception: null,
};

const SCREEN = { kind: 'lecture', fields: [] };

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

const photo = (parcelId: string | null) =>
  savePhoto(
    db,
    files,
    {
      id: newId(),
      parcelId,
      kind: 'etiquette',
      blob: new Blob(['jpeg bytes'], { type: 'image/jpeg' }),
      width: 1200,
      height: 1600,
    },
    NOW,
  );

const kept = async (id: string): Promise<KeptReading> => {
  const loaded = await loadKept(db, id, NOW);
  if (!('kept' in loaded)) throw new Error(loaded.reason);
  return loaded.kept;
};

const report = async (reading: KeptReading, origin: 'revue' | 'lecture') => {
  const read = await keptImage(files, reading.photo);
  if (!read) throw new Error('no image');
  return buildKeptReport(reading, origin, SCREEN, read.image, CONTEXT);
};

describe('a report from the batch review', () => {
  const reviewed = (photoId: string): DraftParcel =>
    draftOf({
      photoId,
      carrier: 'Chronopost',
      tracking: TRACKING,
      trackingNorm: TRACKING,
      trackingConfirmed: true,
      symbols: [{ format: 'Code128', text: TRACKING }],
      ocrLines: [line('SHIP TO:'), line(`TRACKING #: ${TRACKING}`)],
      durations: { codesMs: 97, ocrMs: 820 },
      annex: {
        pieces: null,
        weightKg: { value: 2.4, level: 'sure' },
        service: null,
        reference: null,
      },
    });

  it('sends the stored photo and the kept readings, saying what is gone', async () => {
    const stored = await photo(null);
    await db.draftParcel.put(reviewed(stored.id));
    const sent = await report(await kept('d'), 'revue');

    expect(scanReportV1.parse(JSON.parse(JSON.stringify(sent)))).toEqual(sent);
    expect(sent).toMatchObject({
      origin: 'revue',
      shot: null,
      shotAt: NOW.toISOString(),
      image: { width: 1200, height: 1600, bytes: 10, quality: 0.8 },
      codes: { state: 'done', passes: [] },
      ocr: { state: 'kept' },
      missing: ['frame', 'shot', 'decodePasses'],
      kept: {
        from: 'draft',
        codes: [{ format: 'Code128', text: TRACKING }],
        ocrText: `SHIP TO:\nTRACKING #: ${TRACKING}`,
        durations: { codesMs: 97, ocrMs: 820, fusionMs: null },
      },
    });
    expect(sent.kept?.ocrLines).toHaveLength(2);
    expect(sent.parcel).toBeUndefined();
  });

  it('carries what the review corrected', async () => {
    const stored = await photo(null);
    await db.draftParcel.put(reviewed(stored.id));
    const sent = await report(await kept('d'), 'revue');

    expect(sent.corrections).toEqual(
      expect.arrayContaining([
        { field: 'tracking', value: TRACKING, how: 'confirmed' },
        { field: 'carrier', value: 'Chronopost', how: 'chosen' },
        { field: 'weightKg', value: '2,4', how: 'typed' },
      ]),
    );
  });

  it('says the photo is missing rather than sending readings alone', async () => {
    await db.draftParcel.put(draftOf({ photoId: null }));
    expect(await loadKept(db, 'd', NOW)).toEqual({ reason: 'photo' });

    const stored = await photo(null);
    await db.draftParcel.put(draftOf({ photoId: stored.id }));
    files.files.clear();
    expect(await keptImage(files, stored)).toBeNull();
  });
});

describe('a report from « Ce qui a été lu »', () => {
  const extraction = (parcelId: string): LocalExtraction => ({
    parcelId,
    version: 3,
    fields: {
      tracking: {
        value: TRACKING,
        confidence: 0.95,
        level: 'sure',
        flags: [],
        sources: [
          { kind: '1d', format: 'Code128', confidence: 0.95, value: TRACKING },
          { kind: 'agent', format: 'value', confidence: 1, value: TRACKING },
        ],
      },
    },
    codes: [{ format: 'Code128', text: TRACKING }],
    ocrText: `TRACKING #: ${TRACKING}`,
    durations: { codesMs: 90, ocrMs: 700, fusionMs: 4 },
    provenance: 'device',
    createdAt: NOW,
  });

  it('sends a finished parcel with its text, without boxes or draft', async () => {
    const parcel = parcelRow({ batchId: 'b', tracking: TRACKING });
    await db.parcel.put(parcel);
    await db.extraction.put(extraction(parcel.id));
    await photo(parcel.id);
    const sent = await report(await kept(parcel.id), 'lecture');

    expect(scanReportV1.safeParse(sent).success).toBe(true);
    expect(sent).toMatchObject({
      origin: 'lecture',
      ocr: { state: 'kept' },
      missing: [
        'frame',
        'shot',
        'decodePasses',
        'ocrBoxes',
        'extraction',
        'draft',
      ],
      kept: {
        from: 'stored',
        rules: 3,
        ocrLines: null,
        ocrText: `TRACKING #: ${TRACKING}`,
      },
      draft: { id: parcel.id, reading: 'stored' },
      parcel: { id: parcel.id, tracking: TRACKING },
      corrections: [{ field: 'tracking', value: TRACKING, how: 'confirmed' }],
    });
  });

  it('says why nothing leaves once the readings are gone', async () => {
    const purged = parcelRow({
      batchId: 'b',
      receivedAt: new Date(NOW.getTime() - 31 * DAY),
    });
    const elsewhere = parcelRow({ batchId: 'b' });
    await db.parcel.bulkPut([purged, elsewhere]);
    await photo(purged.id);
    expect(await loadKept(db, purged.id, NOW)).toEqual({ reason: 'purged' });
    expect(await loadKept(db, elsewhere.id, NOW)).toEqual({
      reason: 'elsewhere',
    });

    const unphotographed = parcelRow({ batchId: 'b' });
    await db.parcel.put(unphotographed);
    await db.extraction.put(extraction(unphotographed.id));
    expect(await loadKept(db, unphotographed.id, NOW)).toEqual({
      reason: 'photo',
    });
  });
});

describe('« Envoyer » away from the scan screen', () => {
  const queue = (parcelId: string) =>
    queueKeptReport(db, files, {
      id: newId(),
      parcelId,
      origin: 'lecture',
      comment: ' numéro faux ',
      screen: () => SCREEN,
      context: CONTEXT,
    });

  it('queues the report with the stored photo', async () => {
    const stored = await photo(null);
    await db.draftParcel.put(draftOf({ photoId: stored.id }));
    expect(await keptReason(db, files, 'd')).toBeNull();
    const sent = await queue('d');
    expect(sent).toMatchObject({
      queued: { comment: 'numéro faux', report: { origin: 'lecture' } },
    });
    expect(await db.scanReport.count()).toBe(1);
  });

  it('queues nothing once the readings are purged or the photo file is gone', async () => {
    const purged = parcelRow({
      batchId: 'b',
      receivedAt: new Date(NOW.getTime() - 31 * DAY),
    });
    await db.parcel.put(purged);
    await photo(purged.id);
    expect(await queue(purged.id)).toEqual({ reason: 'purged' });

    const stored = await photo(null);
    await db.draftParcel.put(draftOf({ photoId: stored.id }));
    files.files.clear();
    expect(await keptReason(db, files, 'd')).toBe('photo');
    expect(await queue('d')).toEqual({ reason: 'photo' });
    expect(await keptReason(db, null, 'd')).toBe('photo');

    expect(await db.scanReport.count()).toBe(0);
  });
});
