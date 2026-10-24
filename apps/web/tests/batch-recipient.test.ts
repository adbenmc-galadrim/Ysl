import 'fake-indexeddb/auto';
import type { OcrResult } from '@repo/ocr/worker';
import { beforeEach, describe, expect, it } from 'vitest';
import { copyRecipient, previousNamed } from '#/features/batch/recipient';
import {
  addDraft,
  openBatch,
  promotedStatus,
  updateDraft,
} from '#/features/batch/store';
import type { CourrierDatabase } from '#/features/db/schema';
import { readText } from '#/features/scan/text';
import { NOW, openTestDatabase } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

describe('previousNamed', () => {
  it('names the parcel scanned right before, not the last one named', async () => {
    const batch = await openBatch(db, NOW);
    const named = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, named.id, { readName: 'Camille Morel' });
    const unnamed = await addDraft(db, files, batch.id, null, later(1));
    const current = await addDraft(db, files, batch.id, null, later(2));

    expect(await previousNamed(db, current)).toBeUndefined();
    expect(await previousNamed(db, unnamed)).toMatchObject({
      draft: { id: named.id },
      name: 'Camille Morel',
    });
    expect(await previousNamed(db, named)).toBeUndefined();
  });

  it('takes the name a code gave before the one the OCR guessed', async () => {
    const batch = await openBatch(db, NOW);
    const previous = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, previous.id, { ocrName: 'C. Morel' });
    const current = await addDraft(db, files, batch.id, null, later(1));

    expect((await previousNamed(db, current))?.name).toBe('C. Morel');
    await updateDraft(db, previous.id, { readName: 'Camille Morel' });
    expect((await previousNamed(db, current))?.name).toBe('Camille Morel');
  });
});

describe('copyRecipient', () => {
  it('makes the name sure enough to receive the parcel, and the OCR leaves it alone', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, draft.id, {
      reading: 'read',
      carrier: 'UPS',
      tracking: '1ZE6344W0499230622',
      trackingNorm: '1ZE6344W0499230622',
    });

    expect(await copyRecipient(db, draft.id, 'Camille Morel')).toBe(true);
    const ocr = {
      recognize: () =>
        Promise.resolve<OcrResult>({
          lines: [
            {
              text: 'HUGO LEFEVRE',
              box: { x: 10, y: 40, width: 200, height: 20 },
              score: 0.95,
            },
          ],
          engine: 'paddle',
          width: 1600,
          height: 1200,
          sourceWidth: 1600,
          sourceHeight: 1200,
          timings: { prepMs: 1, ocrMs: 2 },
        }),
    };
    await readText(db, draft.id, new Blob(['x']), ocr, true);

    const copied = await db.draftParcel.get(draft.id);
    expect(copied?.readName).toBe('Camille Morel');
    expect(promotedStatus(copied!)).toBe('recu');
    expect(await copyRecipient(db, 'gone', 'Camille Morel')).toBe(false);
  });
});
