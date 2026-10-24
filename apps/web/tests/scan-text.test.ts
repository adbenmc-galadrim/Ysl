import 'fake-indexeddb/auto';
import type { OcrResult } from '@repo/ocr/worker';
import { beforeEach, describe, expect, it } from 'vitest';
import { addDraft, openBatch } from '#/features/batch/store';
import type { CourrierDatabase } from '#/features/db/schema';
import { readText } from '#/features/scan/text';
import { NOW, openTestDatabase } from './helpers/local-rows';
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

    const text = await readText(db, draft.id, photo().blob, ocr);

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

  it('marks the text failed without touching what the codes gave', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.update(draft.id, {
      reading: 'read',
      carrier: 'UPS',
      readName: 'Hugo Lefèvre',
    });
    const ocr = { recognize: () => Promise.reject(new Error('worker')) };

    const text = await readText(db, draft.id, photo().blob, ocr);

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

    const first = readText(db, draft.id, photo().blob, ocr);
    const second = readText(db, draft.id, photo().blob, ocr);
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

    expect(await readText(db, draft.id, photo().blob, ocr)).toMatchObject({
      kept: false,
      failed: false,
    });
  });
});
