import 'fake-indexeddb/auto';
import type { OcrResult } from '@repo/ocr/worker';
import { beforeEach, describe, expect, it } from 'vitest';
import { addDraft, openBatch, updateDraft } from '#/features/batch/store';
import type { CourrierDatabase } from '#/features/db/schema';
import { readText } from '#/features/scan/text';
import { NOW, openTestDatabase, senderRow } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const photo = () => ({
  blob: new Blob(['etiquette'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

const line = (text: string, y: number) => ({
  text,
  box: { x: 10, y, width: 200, height: 20 },
  score: 0.95,
});

const result = (lines: OcrResult['lines']): OcrResult => ({
  lines,
  engine: 'paddle',
  width: 1600,
  height: 1200,
  sourceWidth: 1600,
  sourceHeight: 1200,
  timings: { prepMs: 1, ocrMs: 2 },
});

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

describe('readText', () => {
  it('writes the lines and the recipient they suggest on the draft', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const ocr = {
      recognize: () =>
        Promise.resolve(
          result([
            line('DESTINATAIRE', 10),
            line('Camille MOREL', 40),
            line('12 RUE DES LILAS', 70),
          ]),
        ),
    };

    const text = await readText(db, draft.id, photo().blob, ocr, true);

    expect(text).toMatchObject({
      ocrName: 'Camille MOREL',
      kept: true,
      failed: false,
    });
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      reading: 'pending',
      ocrState: 'done',
      ocrName: 'Camille MOREL',
      ocrLines: [
        { text: 'DESTINATAIRE', box: { y: 10 }, score: 0.95 },
        { text: 'Camille MOREL' },
        { text: '12 RUE DES LILAS' },
      ],
    });
  });

  it('writes the annex fields the text and the codes give', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.update(draft.id, {
      reading: 'read',
      tracking: '01234567890128',
      trackingNorm: '01234567890128',
      symbols: [{ format: 'Code128', text: '01234567890128' }],
    });
    const ocr = {
      recognize: () =>
        Promise.resolve(
          result([line('PKG 2 OF 3', 10), line('WT 1.2 KG', 40)]),
        ),
    };

    const text = await readText(db, draft.id, photo().blob, ocr, true);

    expect(text.annex).toMatchObject({
      pieces: { index: 2, total: 3, level: 'to-verify' },
      weightKg: { value: 1.2 },
    });
    expect(text.piece).toEqual({ index: 2, total: 3, key: '01234567890128' });
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      annex: { weightKg: { value: 1.2, level: 'to-verify' } },
      pieces: { total: 3, read: [2], key: '01234567890128', photoIds: [] },
    });
  });

  it('leaves the pieces a code announced, and a draft without a number', async () => {
    const batch = await openBatch(db, NOW);
    const coded = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.update(coded.id, {
      trackingNorm: '01234567890128',
      pieces: { total: 3, read: [1], key: 'ups:SHP', photoIds: [] },
    });
    const bare = await addDraft(db, files, batch.id, photo(), NOW);
    const ocr = {
      recognize: () => Promise.resolve(result([line('PKG 2 OF 3', 10)])),
    };

    const first = await readText(db, coded.id, photo().blob, ocr, true);
    const second = await readText(db, bare.id, photo().blob, ocr, true);

    expect(first.piece).toBeNull();
    expect(await db.draftParcel.get(coded.id)).toMatchObject({
      pieces: { read: [1], key: 'ups:SHP' },
    });
    expect(second.piece).toBeNull();
    expect((await db.draftParcel.get(bare.id))?.pieces).toBeNull();
  });

  it('reads a held draft from its copy without writing anything', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const held = {
      ...draft,
      trackingNorm: '01234567890128',
      symbols: [{ format: 'Code128', text: '01234567890128' }],
    };
    await db.draftParcel.delete(draft.id);
    const ocr = {
      recognize: () => Promise.resolve(result([line('PKG 2 OF 3', 10)])),
    };

    const text = await readText(db, draft.id, photo().blob, ocr, true, held);

    expect(text).toMatchObject({
      kept: true,
      piece: { index: 2, total: 3, key: '01234567890128' },
      ocrLines: [{ text: 'PKG 2 OF 3' }],
    });
    expect(await db.draftParcel.get(draft.id)).toBeUndefined();
  });

  it('does not stand in for the reading of the same draft once restored', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const finishes: ((value: OcrResult) => void)[] = [];
    const ocr = {
      recognize: () =>
        new Promise<OcrResult>((resolve) => {
          finishes.push(resolve);
        }),
    };

    const heldReading = readText(db, draft.id, photo().blob, ocr, true, draft);
    const normal = readText(db, draft.id, photo().blob, ocr, true);
    expect(finishes).toHaveLength(2);
    for (const finish of finishes) {
      finish(result([line('SHIP TO: Hugo Lefèvre', 10)]));
    }
    await heldReading;

    expect(await normal).toMatchObject({ ocrName: 'Hugo Lefèvre', kept: true });
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      ocrState: 'done',
      ocrName: 'Hugo Lefèvre',
    });
  });

  it('marks the text failed without touching what the codes gave', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.update(draft.id, {
      reading: 'read',
      carrier: 'UPS',
      readName: 'Hugo Lefèvre',
    });
    const ocr = { recognize: () => Promise.reject(new Error('worker')) };

    const text = await readText(db, draft.id, photo().blob, ocr, true);

    expect(text).toMatchObject({ ocrName: null, kept: true, failed: true });
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      reading: 'read',
      carrier: 'UPS',
      readName: 'Hugo Lefèvre',
      ocrState: 'failed',
      ocrName: null,
    });
  });

  it('reads a draft once when asked twice while the first reading runs', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    let calls = 0;
    let finish: (value: OcrResult) => void = () => undefined;
    const ocr = {
      recognize: () => {
        calls += 1;
        return new Promise<OcrResult>((resolve) => {
          finish = resolve;
        });
      },
    };

    const first = readText(db, draft.id, photo().blob, ocr, true);
    const second = readText(db, draft.id, photo().blob, ocr, true);
    finish(result([line('SHIP TO: Hugo Lefèvre', 10)]));

    expect(await first).toMatchObject({ ocrName: 'Hugo Lefèvre' });
    expect(await second).toMatchObject({ ocrName: 'Hugo Lefèvre' });
    expect(calls).toBe(1);
  });

  it('says so when the draft was undone during the reading', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.delete(draft.id);
    const ocr = { recognize: () => Promise.resolve(result([])) };

    expect(await readText(db, draft.id, photo().blob, ocr, true)).toMatchObject(
      {
        kept: false,
        failed: false,
      },
    );
  });
  it('skips the text while the reader files are not on the device', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    let called = 0;
    const ocr = {
      recognize: () => {
        called += 1;
        return Promise.resolve(result([]));
      },
    };

    const text = await readText(db, draft.id, photo().blob, ocr, false);

    expect(text).toEqual({
      draftId: draft.id,
      ocrName: null,
      sender: null,
      annex: null,
      piece: null,
      ocrLines: [],
      kept: true,
      failed: false,
    });
    expect(called).toBe(0);
    expect((await db.draftParcel.get(draft.id))?.ocrState).toBe('skipped');
  });
});

describe('readText — sender', () => {
  const fromBlock = (name: string) =>
    result([
      line('EXPÉDITEUR', 10),
      line(name, 40),
      line('4 RUE DES FILATURES', 70),
      line('DESTINATAIRE', 200),
      line('Camille MOREL', 230),
    ]);

  it('proposes the FROM block as a bare guess when nothing else names a sender', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const ocr = {
      recognize: () => Promise.resolve(fromBlock('ATELIER TISSAGE NORD')),
    };

    const text = await readText(db, draft.id, photo().blob, ocr, true);

    expect(text.sender).toEqual({
      name: 'ATELIER TISSAGE NORD',
      id: null,
      level: 'none',
      confidence: 0.4,
      source: 'ocr',
      account: null,
      read: 'ATELIER TISSAGE NORD',
      alias: false,
    });
    expect(text.ocrName).toBe('Camille MOREL');
    expect((await db.draftParcel.get(draft.id))?.sender).toEqual(text.sender);
  });

  it('matches the FROM block to a sender already seen, to verify', async () => {
    const known = senderRow({
      displayName: 'Atelier Tissage Nord',
      nameNorm: 'atelier tissage nord',
    });
    await db.sender.add(known);
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const ocr = {
      recognize: () => Promise.resolve(fromBlock('ATELIER TISSAGE N0RD')),
    };

    const text = await readText(db, draft.id, photo().blob, ocr, true);

    expect(text.sender).toMatchObject({
      name: 'Atelier Tissage Nord',
      id: known.id,
      level: 'to-verify',
      source: 'learned',
    });
  });

  it('never replaces a sender a code or the dictionary settled', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const settled = {
      name: 'Metalworks SpA',
      id: null,
      level: 'sure' as const,
      source: '2d' as const,
      account: null,
    };
    await updateDraft(db, draft.id, { sender: settled });
    const ocr = {
      recognize: () => Promise.resolve(fromBlock('ATELIER TISSAGE NORD')),
    };

    const text = await readText(db, draft.id, photo().blob, ocr, true);

    expect(text.sender).toEqual(settled);
    expect((await db.draftParcel.get(draft.id))?.sender).toEqual(settled);
  });

  it('leaves the sender alone when the text has no FROM block', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const ocr = {
      recognize: () =>
        Promise.resolve(
          result([line('DESTINATAIRE', 10), line('Camille MOREL', 40)]),
        ),
    };

    const text = await readText(db, draft.id, photo().blob, ocr, true);

    expect(text.sender).toBeNull();
    expect((await db.draftParcel.get(draft.id))?.sender).toBeNull();
  });

  it('keeps the codes’ sender when the text is skipped or fails', async () => {
    const batch = await openBatch(db, NOW);
    const settled = {
      name: 'Metalworks SpA',
      id: null,
      level: 'sure' as const,
      source: '2d' as const,
      account: null,
    };
    const skipped = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, skipped.id, { sender: settled });
    const failed = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, failed.id, { sender: settled });
    const broken = { recognize: () => Promise.reject(new Error('boom')) };

    const a = await readText(db, skipped.id, photo().blob, broken, false);
    const b = await readText(db, failed.id, photo().blob, broken, true);

    expect(a).toMatchObject({ sender: settled, failed: false });
    expect(b).toMatchObject({ sender: settled, failed: true });
  });
});
