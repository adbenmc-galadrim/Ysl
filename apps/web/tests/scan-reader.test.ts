import 'fake-indexeddb/auto';
import type { DecodeResult } from '@repo/barcode/worker';
import { GS, RS } from '@repo/contract/codes';
import { beforeEach, describe, expect, it } from 'vitest';
import { addDraft, openBatch } from '#/features/batch/store';
import type { CourrierDatabase } from '#/features/db/schema';
import { DecodeQueue } from '#/features/scan/decode-queue';
import { readDraft, recoverPending } from '#/features/scan/reader';
import {
  NOW,
  openTestDatabase,
  senderAccountRow,
  senderRow,
} from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const symbol = (format: string, text: string): DecodeResult['symbols'][0] => ({
  format,
  text,
  isValid: true,
  position: {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 },
    bottomLeft: { x: 0, y: 1 },
  },
  orientation: 0,
});

const result = (symbols: DecodeResult['symbols']): DecodeResult => ({
  symbols,
  steps: [],
  width: 1,
  height: 1,
  totalMs: 0,
});

const bitmap = () => {
  let closed = false;
  return {
    close: () => {
      closed = true;
    },
    get closed() {
      return closed;
    },
  } as unknown as ImageBitmap & { closed: boolean };
};

const photo = () => ({
  blob: new Blob(['etiquette'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

describe('readDraft', () => {
  it('prefills the sender of a UPS account the dictionary knows', async () => {
    const sender = senderRow({ displayName: 'Metalworks SpA' });
    await db.sender.add(sender);
    await db.senderAccount.add(
      senderAccountRow({
        carrier: 'ups',
        accountNumber: 'E6344W',
        senderId: sender.id,
        confirmations: 3,
      }),
    );
    const queue = new DecodeQueue(
      () => Promise.resolve(result([symbol('Code128', '1ZE6344W0499230622')])),
      1,
    );
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await queue.acquire();

    const reading = await readDraft(db, queue, draft.id, bitmap(), bitmap());

    const expected = {
      name: 'Metalworks SpA',
      id: sender.id,
      level: 'sure',
      confidence: 0.95,
      source: 'learned',
      account: { carrier: 'ups', accountNumber: 'E6344W' },
      read: null,
      alias: false,
    };
    expect(reading.sender).toEqual(expected);
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      sender: expected,
    });
  });

  it('keeps the account read on the draft when no sender owns it yet', async () => {
    const queue = new DecodeQueue(
      () => Promise.resolve(result([symbol('Code128', '1ZE6344W0499230622')])),
      1,
    );
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await queue.acquire();

    const reading = await readDraft(db, queue, draft.id, bitmap(), bitmap());

    expect(reading.sender).toBeNull();
    expect((await db.draftParcel.get(draft.id))?.sender).toBeNull();
  });

  it('goes back for the carrier symbol it missed, then frees the slot', async () => {
    const calls: unknown[] = [];
    const queue = new DecodeQueue((_bitmap, options) => {
      calls.push(options);
      return Promise.resolve(
        result(
          calls.length === 1
            ? [symbol('Code128', '1ZE6344W0499230622')]
            : [symbol('MaxiCode', '[)>maxi')],
        ),
      );
    }, 1);
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const [first, clone] = [bitmap(), bitmap()];
    await queue.acquire();

    const reading = await readDraft(db, queue, draft.id, first, clone);

    expect(calls).toEqual([undefined, { expect: ['MaxiCode'] }]);
    expect(reading.kept).toBe(true);
    expect(reading.trackingNorm).toBe('1ZE6344W0499230622');
    expect(reading.symbols.map((s) => s.format)).toEqual([
      'Code128',
      'MaxiCode',
    ]);
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      reading: 'read',
      carrier: 'UPS',
      annex: { service: { code: '04', label: null, level: 'sure' } },
      tracking: '1ZE6344W0499230622',
      symbols: [
        { format: 'Code128', text: '1ZE6344W0499230622' },
        { format: 'MaxiCode', text: '[)>maxi' },
      ],
    });
    expect(queue.pending).toBe(0);
    expect(clone.closed).toBe(false);
  });

  it('keeps the recipient a structured code names, none from a bare 1D', async () => {
    const aztec = [
      `[)>${RS}01`,
      '02',
      '0075007',
      '250',
      '801',
      '118J0229907975',
      'GEOP',
      '123456',
      '',
      '',
      '001/002',
      '00.50KG',
      'N',
      '24 RUE DE L UNIVERSITE',
      'PARIS',
      '',
      'CAMILLE MOREL',
    ].join(GS);
    const batch = await openBatch(db, NOW);
    const named = await addDraft(db, files, batch.id, photo(), NOW);
    const bare = await addDraft(db, files, batch.id, photo(), NOW);
    const withAztec = new DecodeQueue(
      () => Promise.resolve(result([symbol('Aztec', aztec)])),
      1,
    );
    const withCode128 = new DecodeQueue(
      () => Promise.resolve(result([symbol('Code128', '1ZE6344W0499230622')])),
      1,
    );
    await withAztec.acquire();
    await readDraft(db, withAztec, named.id, bitmap(), bitmap());
    await withCode128.acquire();
    await readDraft(db, withCode128, bare.id, bitmap(), bitmap());

    expect(await db.draftParcel.get(named.id)).toMatchObject({
      carrier: 'Colissimo',
      readName: 'CAMILLE MOREL',
    });
    expect(await db.draftParcel.get(bare.id)).toMatchObject({
      carrier: 'UPS',
      readName: null,
    });
  });

  it('writes the piece a structured code announces on the draft', async () => {
    const maxicode = `[)>${RS}01${GS}9675007${GS}250${GS}004${GS}1Z99230623${GS}UPSN${GS}E6344W${GS}296${GS}SHIP42${GS}2/3${GS}3${GS}N${GS}${GS}PARIS`;
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    const queue = new DecodeQueue(
      () =>
        Promise.resolve(
          result([
            symbol('Code128', '1ZE6344W0499230622'),
            symbol('MaxiCode', maxicode),
          ]),
        ),
      1,
    );
    await queue.acquire();

    const reading = await readDraft(db, queue, draft.id, bitmap(), bitmap());

    expect(reading.piece).toEqual({ index: 2, total: 3, key: 'ups:SHIP42' });
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      pieces: { total: 3, read: [2], key: 'ups:SHIP42', photoIds: [] },
    });
  });

  it('says so when the draft was undone during the reading', async () => {
    let finish: (value: DecodeResult) => void = () => undefined;
    let calls = 0;
    const queue = new DecodeQueue(
      () =>
        (calls += 1) === 1
          ? new Promise((resolve) => {
              finish = resolve;
            })
          : Promise.resolve(result([])),
      1,
    );
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await queue.acquire();
    const reading = readDraft(db, queue, draft.id, bitmap(), bitmap());
    await db.draftParcel.delete(draft.id);
    finish(result([symbol('Code128', '1ZE6344W0499230622')]));

    expect((await reading).kept).toBe(false);
    expect(queue.pending).toBe(0);
  });

  it('marks the draft failed and frees the slot when the Worker fails', async () => {
    const queue = new DecodeQueue(() => Promise.reject(new Error('worker')), 1);
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await queue.acquire();

    const reading = await readDraft(db, queue, draft.id, bitmap(), bitmap());

    expect(reading).toMatchObject({ kept: true, failed: true, symbols: [] });
    expect(await db.draftParcel.get(draft.id)).toMatchObject({
      reading: 'failed',
      ocrState: 'pending',
    });
    expect(queue.pending).toBe(0);
  });
});

describe('recoverPending', () => {
  const toBitmap = () => Promise.resolve(bitmap());

  it('reads a pending draft again from its photo, fails one without, leaves the rest', async () => {
    const queue = new DecodeQueue(
      () => Promise.resolve(result([symbol('Code128', '1ZE6344W0499230622')])),
      1,
    );
    const batch = await openBatch(db, NOW);
    const orphan = await addDraft(db, files, batch.id, null, NOW);
    const stuck = await addDraft(db, files, batch.id, photo(), NOW);
    const done = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.update(done.id, { reading: 'read', carrier: 'DHL' });

    await recoverPending(db, files, queue, batch.id, toBitmap);

    expect((await db.draftParcel.get(orphan.id))?.reading).toBe('failed');
    expect(await db.draftParcel.get(stuck.id)).toMatchObject({
      reading: 'read',
      carrier: 'UPS',
    });
    expect(await db.draftParcel.get(done.id)).toMatchObject({
      reading: 'read',
      carrier: 'DHL',
    });
    expect(queue.pending).toBe(0);
  });

  it('reads the text of the drafts whose codes landed but not their text', async () => {
    const queue = new DecodeQueue(
      () => Promise.resolve(result([symbol('Code128', '1ZE6344W0499230622')])),
      1,
    );
    const batch = await openBatch(db, NOW);
    const pending = await addDraft(db, files, batch.id, photo(), NOW);
    const codesOnly = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.update(codesOnly.id, { reading: 'read' });
    const complete = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.update(complete.id, {
      reading: 'read',
      ocrState: 'done',
    });
    const failed = await addDraft(db, files, batch.id, photo(), NOW);
    await db.draftParcel.update(failed.id, { reading: 'failed' });
    const typed = await addDraft(db, files, batch.id, null, NOW);
    await db.draftParcel.update(typed.id, {
      reading: 'typed',
      ocrState: 'skipped',
    });
    const texts: string[] = [];

    await recoverPending(db, files, queue, batch.id, toBitmap, (id) => {
      texts.push(id);
      return Promise.resolve();
    });

    expect(texts.sort()).toEqual([pending.id, codesOnly.id, failed.id].sort());
  });

  it('frees the slot and fails the draft when the photo cannot be read', async () => {
    const queue = new DecodeQueue(() => Promise.resolve(result([])), 1);
    const batch = await openBatch(db, NOW);
    const stuck = await addDraft(db, files, batch.id, photo(), NOW);
    files.files.clear();

    await recoverPending(db, files, queue, batch.id, toBitmap);

    expect((await db.draftParcel.get(stuck.id))?.reading).toBe('failed');
    expect(queue.pending).toBe(0);
  });
});
