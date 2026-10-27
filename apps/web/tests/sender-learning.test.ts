import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDraft,
  finishBatch,
  openBatch,
  updateDraft,
} from '#/features/batch/store';
import type {
  CourrierDatabase,
  DraftParcel,
  DraftSender,
} from '#/features/db/schema';
import { editOf, saveParcelEdit } from '#/features/parcels/edit';
import { settleSender } from '#/features/review/actions';
import { reviewOf } from '#/features/review/model';
import { resolveSender } from '#/features/scan/sender';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  senderAccountRow,
  senderRow,
} from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const UPS_LABEL = [{ format: 'Code128', text: '1ZE6344W0499230622' }];
const MISREAD = 'ARG PARIS SEPT';

const photo = () => ({
  blob: new Blob(['etiquette'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

const guessed = (overrides: Partial<DraftSender> = {}): DraftSender => ({
  name: MISREAD,
  id: null,
  level: 'none',
  confidence: 0.4,
  source: 'ocr',
  account: null,
  read: MISREAD,
  ...overrides,
});

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

/** One batch of one parcel whose sender the reading proposed, finished after `review`. */
async function scanOnce(
  sender: DraftSender | null,
  review: (draft: DraftParcel) => unknown = () => undefined,
  at = NOW,
): Promise<string> {
  const batch = await openBatch(db, at);
  const draft = await addDraft(db, files, batch.id, photo(), at);
  await updateDraft(db, draft.id, { reading: 'read', sender });
  await review((await db.draftParcel.get(draft.id))!);
  await finishBatch(db, { batchId: batch.id, agentId: 'agent-1', now: at });
  return draft.id;
}

describe('a sender the agent corrects in the review', () => {
  it('teaches the corrected name, the account and the OCR text, ahead of the parcel', async () => {
    const parcelId = await scanOnce(
      guessed({
        level: 'to-verify',
        confidence: 0.7,
        account: { carrier: 'ups', accountNumber: 'E6344W' },
      }),
      (draft) => settleSender(db, draft.id, 'Atelier Rive Gauche'),
    );

    const [sender] = await db.sender.toArray();
    expect(sender).toMatchObject({
      displayName: 'Atelier Rive Gauche',
      nameNorm: 'atelier rive gauche',
      seenCount: 1,
    });
    expect(await db.senderAccount.toArray()).toEqual([
      expect.objectContaining({
        carrier: 'ups',
        accountNumber: 'E6344W',
        senderId: sender!.id,
        confirmations: 1,
      }),
    ]);
    expect(await db.senderAlias.toArray()).toEqual([
      expect.objectContaining({
        aliasNorm: 'arg paris sept',
        senderId: sender!.id,
        confirmations: 1,
      }),
    ]);
    expect(await db.parcel.get(parcelId)).toMatchObject({
      senderId: sender!.id,
      senderName: 'Atelier Rive Gauche',
    });
    const queued = await db.outbox.orderBy('seq').toArray();
    expect(queued.map((op) => op.entity)).toEqual([
      'sender',
      'sender_account',
      'sender_alias',
      'batch',
      'parcel',
    ]);
  });

  it('proposes it at the next reading of the same block, rising with each confirmation', async () => {
    await scanOnce(guessed({ level: 'to-verify', confidence: 0.7 }), (draft) =>
      settleSender(db, draft.id, 'Atelier Rive Gauche'),
    );
    const [sender] = await db.sender.toArray();

    const first = await resolveSender(db, [], MISREAD);
    expect(first).toMatchObject({
      name: 'Atelier Rive Gauche',
      id: sender!.id,
      level: 'none',
      confidence: 0.3,
      source: 'learned',
      read: MISREAD,
      alias: true,
    });

    let proposed = first!;
    for (const [n, expected] of [
      [1, 0.5],
      [2, 0.7],
      [3, 0.9],
    ] as const) {
      await scanOnce(
        proposed,
        async (draft) => {
          expect(reviewOf(draft).steps).toContainEqual({ field: 'sender' });
          await settleSender(db, draft.id, draft.sender!.name);
        },
        later(n * 60),
      );
      proposed = (await resolveSender(db, [], MISREAD))!;
      expect(proposed.confidence).toBe(expected);
    }
    expect(proposed.level).toBe('sure');
    expect(await db.senderAlias.count()).toBe(1);
    expect((await db.senderAlias.toArray())[0]?.confirmations).toBe(4);
  });

  it('moves an alias to the sender the agent names instead', async () => {
    await scanOnce(guessed({ level: 'to-verify' }), (draft) =>
      settleSender(db, draft.id, 'Atelier Rive Gauche'),
    );
    const proposed = await resolveSender(db, [], MISREAD);
    await scanOnce(
      proposed,
      (draft) => settleSender(db, draft.id, 'Ateliers de Paris'),
      later(60),
    );

    const paris = await db.sender
      .where('nameNorm')
      .equals('ateliers de paris')
      .first();
    expect(await db.senderAlias.toArray()).toEqual([
      expect.objectContaining({ senderId: paris!.id, confirmations: 1 }),
    ]);
  });
});

describe('a sender nobody corrected', () => {
  it('teaches no alias from a sure reading, and nothing from one left to verify', async () => {
    await scanOnce(
      guessed({
        name: 'Atelier Rive Gauche',
        level: 'sure',
        confidence: 0.97,
        source: '2d',
      }),
    );
    await scanOnce(guessed({ level: 'to-verify' }), undefined, later(60));

    expect(await db.senderAlias.count()).toBe(0);
    expect((await db.sender.toArray()).map((row) => row.displayName)).toEqual([
      'Atelier Rive Gauche',
    ]);
  });

  it('asks nothing about a bare OCR guess', async () => {
    await scanOnce(guessed(), (draft) => {
      expect(reviewOf(draft).steps).not.toContainEqual({ field: 'sender' });
    });
    expect(await db.sender.count()).toBe(0);
  });
});

describe('a carrier account another sender owns', () => {
  const owner = senderRow({
    displayName: 'Maison Duval',
    nameNorm: 'maison duval',
  });
  const account = { carrier: 'ups', accountNumber: 'E6344W' };

  const corrected = (at: Date) =>
    scanOnce(
      guessed({
        name: 'Maison Duval',
        id: owner.id,
        level: 'sure',
        source: 'learned',
        account,
      }),
      (draft) => settleSender(db, draft.id, 'Duval Logistique'),
      at,
    );

  beforeEach(async () => {
    await db.sender.add(owner);
    await db.senderAccount.add(
      senderAccountRow({ senderId: owner.id, confirmations: 3 }),
    );
  });

  it('moves to the agent’s sender at the second correction that agrees', async () => {
    await corrected(NOW);
    const duval = await db.sender
      .where('nameNorm')
      .equals('duval logistique')
      .first();
    expect((await db.senderAccount.toArray())[0]).toMatchObject({
      senderId: owner.id,
      challengerId: duval!.id,
      challenges: 1,
    });

    await corrected(later(60));

    expect((await db.senderAccount.toArray())[0]).toMatchObject({
      senderId: duval!.id,
      confirmations: 2,
      challengerId: null,
      challenges: 0,
    });
    expect((await resolveSender(db, UPS_LABEL, null))?.name).toBe(
      'Duval Logistique',
    );
  });

  it('stays with its owner when a confirmation comes between two corrections', async () => {
    await corrected(NOW);
    await scanOnce(
      guessed({
        name: 'Maison Duval',
        id: owner.id,
        level: 'sure',
        source: 'learned',
        account,
      }),
      undefined,
      later(30),
    );
    await corrected(later(60));

    expect((await db.senderAccount.toArray())[0]).toMatchObject({
      senderId: owner.id,
      confirmations: 4,
      challenges: 1,
    });
  });
});

describe('a sender corrected on the parcel’s sheet', () => {
  it('learns the name, the label’s account and its OCR text', async () => {
    const parcel = parcelRow({ senderName: MISREAD, senderId: null });
    await db.parcel.put(parcel);
    await db.extraction.put({
      parcelId: parcel.id,
      version: 1,
      fields: {
        sender: {
          value: MISREAD,
          confidence: 0.4,
          level: 'none',
          flags: [],
          sources: [
            { kind: 'ocr', format: 'sender', confidence: 0.4, value: MISREAD },
            { kind: 'ocr', format: 'block', confidence: 0.4, value: MISREAD },
          ],
        },
      },
      codes: UPS_LABEL,
      ocrText: null,
      durations: { codesMs: null, ocrMs: null },
      provenance: 'device',
      createdAt: NOW,
    });

    await saveParcelEdit(
      db,
      parcel.id,
      { ...editOf(parcel), sender: 'Atelier Rive Gauche' },
      { agentId: 'agent-1', now: NOW },
    );

    const sender = await db.sender
      .where('nameNorm')
      .equals('atelier rive gauche')
      .first();
    expect(await db.parcel.get(parcel.id)).toMatchObject({
      senderId: sender!.id,
      senderName: 'Atelier Rive Gauche',
    });
    expect(await db.senderAccount.toArray()).toEqual([
      expect.objectContaining({
        accountNumber: 'E6344W',
        senderId: sender!.id,
      }),
    ]);
    expect((await resolveSender(db, [], MISREAD))?.name).toBe(
      'Atelier Rive Gauche',
    );
    expect(await resolveSender(db, UPS_LABEL, null)).toMatchObject({
      name: 'Atelier Rive Gauche',
      level: 'sure',
    });
  });
});

describe('a sender respelled on the parcel’s sheet', () => {
  it('keeps its row and teaches nothing for a change of case or accents', async () => {
    const known = senderRow({ displayName: 'Amazon', nameNorm: 'amazon' });
    await db.sender.add(known);
    const parcel = parcelRow({ senderName: 'Amazon', senderId: known.id });
    await db.parcel.put(parcel);

    await saveParcelEdit(
      db,
      parcel.id,
      { ...editOf(parcel), sender: 'AMAZON' },
      { agentId: 'agent-1', now: NOW },
    );

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      senderName: 'AMAZON',
      senderId: known.id,
    });
    expect(await db.sender.get(known.id)).toMatchObject({ seenCount: 1 });
    expect(await db.sender.count()).toBe(1);
  });
});
