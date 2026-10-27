import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDraft,
  finishBatch,
  listDrafts,
  openBatch,
  updateDraft,
} from '#/features/batch/store';
import { CourrierDatabase } from '#/features/db/schema';
import type { DraftParcel, DraftRecipient } from '#/features/db/schema';
import { parseAnnex, settleAnnex, skipDraft } from '#/features/review/actions';
import { reviewBatch, reviewOf, reviewSummary } from '#/features/review/model';
import { pickTracking } from '#/features/scan/confirm';
import { NOW } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const t = createTranslator(DEFAULT_LOCALE);

const UPS = '1ZE6344W0499230622';
const DHL = '5413337112';
const ODD = 'AB1234567';

const card: DraftRecipient = {
  kind: 'person',
  id: 'p-camille',
  name: 'Camille Morel',
  source: 'agent',
};

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

const read = (tracking: string, carrier: string | null) => ({
  reading: 'read' as const,
  carrier,
  tracking,
  trackingNorm: tracking,
  symbols: [{ format: 'Code128', text: tracking }],
  ocrState: 'done' as const,
});

let name: string;
let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  name = `review-${Math.random()}`;
  db = new CourrierDatabase(name);
  await db.open();
  files = new MemoryFiles();
});

/**
 * The batch of the brief: a sure UPS, a DHL Express no context vouches for
 * (« à vérifier »), a number of no known shape (below 0,60), a name the OCR
 * guessed with no card.
 */
async function batchOfFour() {
  const batch = await openBatch(db, NOW);
  const add = async (at: number, patch: Partial<DraftParcel>) => {
    const draft = await addDraft(db, files, batch.id, null, later(at));
    await updateDraft(db, draft.id, patch);
    return draft.id;
  };
  const sure = await add(0, { ...read(UPS, 'UPS'), recipient: card });
  const dhl = await add(1, { ...read(DHL, 'DHL Express'), recipient: card });
  const odd = await add(2, { ...read(ODD, null), recipient: card });
  const guessed = await add(3, { ...read(UPS, 'UPS'), ocrName: 'C. Morel' });
  return { batch, sure, dhl, odd, guessed };
}

const ids = (items: { draft: DraftParcel }[]) => items.map((i) => i.draft.id);

describe('reviewBatch', () => {
  it('puts the least sure first and the sure ones at the bottom', async () => {
    const { batch, sure, dhl, odd, guessed } = await batchOfFour();

    const review = reviewBatch(await listDrafts(db, batch.id));

    expect(ids(review.toCheck)).toEqual([odd, guessed, dhl]);
    expect(ids(review.ready)).toEqual([sure]);
    expect(review.toCheck[0]!.steps).toEqual([
      { field: 'tracking', level: 'none' },
    ]);
    expect(review.toCheck.at(-1)!.steps).toEqual([
      { field: 'tracking', level: 'to-verify' },
    ]);
    expect(reviewSummary(review, t)).toBe(
      '4 colis lus. Trois demandent votre avis, les autres sont prêts.',
    );
  });

  it('asks one field at a time: the number, the recipient, then the annex', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, draft.id, {
      ...read(DHL, 'DHL Express'),
      ocrName: 'C. Morel',
      annex: {
        pieces: null,
        weightKg: { value: 2.4, level: 'to-verify' },
        service: null,
        reference: { value: 'PO-77', level: 'to-verify' },
      },
    });

    const [only] = await listDrafts(db, batch.id);

    expect(reviewOf(only!).steps.map((step) => step.field)).toEqual([
      'tracking',
      'recipient',
      'weightKg',
      'reference',
    ]);
  });

  it('does not take a name a code prints for someone to tell', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, draft.id, {
      ...read(UPS, 'UPS'),
      readName: 'SAINT LAURENT',
    });

    const [only] = await listDrafts(db, batch.id);

    expect(reviewOf(only!)).toMatchObject({
      group: 'toCheck',
      steps: [{ field: 'recipient' }],
    });
  });
});

describe('the batch saved from the review', () => {
  it('validates the sure ones as a group and leaves the doubts untouched', async () => {
    const { batch, sure, dhl, odd, guessed } = await batchOfFour();

    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1' });

    expect(await db.parcel.get(sure)).toMatchObject({ status: 'recu' });
    for (const id of [dhl, odd, guessed]) {
      expect(await db.parcel.get(id)).toMatchObject({ status: 'a_completer' });
    }
    expect(await db.parcel.get(dhl)).toMatchObject({ tracking: DHL });
  });

  it('confirms a number « à vérifier » in one tap, out of « À compléter »', async () => {
    const { batch, dhl } = await batchOfFour();

    await pickTracking(dhl, DHL, db);

    expect(await db.draftParcel.get(dhl)).toMatchObject({
      trackingConfirmed: true,
    });
    expect(reviewOf((await db.draftParcel.get(dhl))!).group).toBe('ready');
    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1' });
    expect(await db.parcel.get(dhl)).toMatchObject({ status: 'recu' });
  });

  it('takes the chip picked below 0,60 with the carrier its format names', async () => {
    const { odd } = await batchOfFour();

    await pickTracking(odd, DHL, db);

    expect(await db.draftParcel.get(odd)).toMatchObject({
      tracking: DHL,
      carrier: 'DHL Express',
      trackingConfirmed: true,
    });
  });

  it('leaves a number picked with no carrier « À compléter »', async () => {
    const { odd } = await batchOfFour();

    await pickTracking(odd, ODD, db);

    expect(reviewOf((await db.draftParcel.get(odd))!)).toMatchObject({
      group: 'toComplete',
      steps: [],
    });
  });

  it('keeps a parcel passed « À compléter », listed apart', async () => {
    const { batch, dhl } = await batchOfFour();

    await skipDraft(db, dhl);

    const review = reviewBatch(await listDrafts(db, batch.id));
    expect(ids(review.toComplete)).toEqual([dhl]);
    expect(reviewSummary(review, t)).toBe(
      '4 colis lus. Deux demandent votre avis, un reste à compléter, les autres sont prêts.',
    );
    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1' });
    expect(await db.parcel.get(dhl)).toMatchObject({ status: 'a_completer' });
  });

  it('writes an annex field kept or corrected as sure', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, draft.id, {
      ...read(UPS, 'UPS'),
      recipient: card,
      annex: {
        pieces: null,
        weightKg: { value: 2.4, level: 'to-verify' },
        service: { code: '65', label: 'Saver', level: 'to-verify' },
        reference: null,
      },
    });

    expect(await settleAnnex(db, draft.id, 'service', 'Saver')).toBe(true);
    expect(await settleAnnex(db, draft.id, 'weightKg', '3,1')).toBe(true);

    const settled = (await db.draftParcel.get(draft.id))!;
    expect(settled.annex).toMatchObject({
      weightKg: { value: 3.1, level: 'sure' },
      service: { code: '65', label: 'Saver', level: 'sure' },
    });
    expect(reviewOf(settled).group).toBe('ready');
    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1' });
    expect(await db.parcel.get(draft.id)).toMatchObject({
      weightKg: 3.1,
      carrierService: 'Saver',
    });
  });

  it('counts a single parcel in the singular', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, draft.id, { ...read(UPS, 'UPS'), recipient: card });

    expect(reviewSummary(reviewBatch(await listDrafts(db, batch.id)), t)).toBe(
      '1 colis lu. Tout est sûr.',
    );
  });

  it('refuses a correction that does not hold', () => {
    expect(parseAnnex('weightKg', '900', null)).toBeUndefined();
    expect(parseAnnex('pieces', '4/3', null)).toBeUndefined();
    expect(parseAnnex('pieces', '2 sur 3', null)).toEqual({
      index: 2,
      total: 3,
      level: 'sure',
    });
    expect(parseAnnex('reference', '  ', null)).toBeNull();
  });
});

describe('a batch cut short in the middle of its review', () => {
  it('comes back with what the agent confirmed and passed', async () => {
    const { batch, sure, dhl, odd, guessed } = await batchOfFour();
    await pickTracking(dhl, DHL, db);
    await skipDraft(db, odd);
    db.close();

    const relaunched = new CourrierDatabase(name);
    await relaunched.open();
    const review = reviewBatch(await listDrafts(relaunched, batch.id));

    expect(ids(review.toCheck)).toEqual([guessed]);
    expect(ids(review.toComplete)).toEqual([odd]);
    expect(ids(review.ready)).toEqual([sure, dhl]);
    relaunched.close();
  });
});
