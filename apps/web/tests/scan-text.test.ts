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
      source: 'ocr',
      account: null,
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
});
