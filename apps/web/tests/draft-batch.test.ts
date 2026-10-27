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
  setDraftDamage,
  typedDraft,
  addTypedDraft,
  undoLast,
  updateDraft,
} from '#/features/batch/store';
import type { CourrierDatabase, DraftParcel } from '#/features/db/schema';
import {
  NOW,
  openTestDatabase,
  senderAccountRow,
  senderRow,
} from './helpers/local-rows';
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

const UPS = '1ZE6344W0499230622';
const DHL = '5413337112';

describe('promotedStatus', () => {
  it('needs a carrier, a number and a name to count as received', () => {
    const full = { carrier: 'UPS', tracking: UPS, readName: 'Camille Morel' };
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
        draft({ carrier: 'UPS', tracking: UPS, ocrName: 'Camille Morel' }),
      ),
    ).toBe('a_completer');
  });

  it('leaves a tracking no key vouches for to complete (F26, O1)', () => {
    const read = {
      carrier: 'DHL Express',
      tracking: DHL,
      trackingNorm: DHL,
      readName: 'Camille Morel',
      symbols: [{ format: 'Code128', text: DHL }],
    };
    expect(promotedStatus(draft(read))).toBe('a_completer');
    expect(promotedStatus(draft({ ...read, reading: 'typed' }))).toBe('recu');
    expect(promotedStatus(draft({ ...read, trackingConfirmed: true }))).toBe(
      'recu',
    );
  });

  it('takes the card the agent chose as a sure recipient', () => {
    expect(
      promotedStatus(
        draft({
          carrier: 'UPS',
          tracking: UPS,
          ocrName: 'C. Morel',
          recipient: {
            kind: 'person',
            id: 'p',
            name: 'Camille Morel',
            source: 'agent',
          },
        }),
      ),
    ).toBe('recu');
  });
});

describe('finishBatch', () => {
  it('keeps what the reader made of each label, scored, on this device', async () => {
    const batch = await openBatch(db, NOW);
    const read = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, read.id, {
      reading: 'read',
      carrier: 'DHL Express',
      tracking: DHL,
      trackingNorm: DHL,
      readName: 'Camille Morel',
      symbols: [{ format: 'Code128', text: DHL }],
      ocrName: 'Camille Morel',
      ocrLines: [
        {
          text: 'SHIP TO CAMILLE MOREL',
          score: 0.9,
          box: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
      durations: { codesMs: 120, ocrMs: 900 },
    });
    const end = later(30);

    await finishBatch(db, { batchId: batch.id, agentId: 'a', now: end });

    expect(await db.parcel.get(read.id)).toMatchObject({
      status: 'a_completer',
    });
    expect(await db.extraction.get(read.id)).toMatchObject({
      parcelId: read.id,
      version: 1,
      fields: {
        tracking: {
          value: DHL,
          level: 'to-verify',
          flags: ['unkeyed'],
          sources: [{ kind: '1d', format: 'Code128' }],
        },
        recipient: { value: 'Camille Morel', level: 'sure' },
      },
      codes: [{ format: 'Code128', text: DHL }],
      ocrText: 'SHIP TO CAMILLE MOREL',
      durations: { codesMs: 120, ocrMs: 900 },
      provenance: 'device',
      createdAt: end,
    });
  });

  it('writes the weight, the service and the reference the label gave', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, draft.id, {
      reading: 'read',
      annex: {
        pieces: null,
        weightKg: { value: 1.2, level: 'to-verify' },
        service: { code: '328', label: null, level: 'sure' },
        reference: { value: 'PO-4471', level: 'sure' },
      },
    });

    await finishBatch(db, { batchId: batch.id, agentId: 'a', now: later(9) });

    expect(await db.parcel.get(draft.id)).toMatchObject({
      weightKg: 1.2,
      carrierService: '328',
      reference: 'PO-4471',
    });
  });

  it('names the service when the carrier does', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, draft.id, {
      reading: 'read',
      annex: {
        pieces: null,
        weightKg: null,
        service: { code: '02', label: '2nd Day Air', level: 'sure' },
        reference: null,
      },
    });

    await finishBatch(db, { batchId: batch.id, agentId: 'a', now: later(9) });

    expect(await db.parcel.get(draft.id)).toMatchObject({
      weightKg: null,
      carrierService: '2nd Day Air',
      reference: null,
    });
  });

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

  it('carries a reserve set during the batch onto the parcel, its event and photos', async () => {
    const batch = await openBatch(db, NOW);
    const damaged = await addDraft(db, files, batch.id, photo(), NOW);
    const input = {
      reason: 'ouvert' as const,
      note: 'Scotch arraché',
      notifyRecipient: true,
      carrierReserve: true,
    };
    await setDraftDamage(db, files, damaged.id, input, [photo()], later(5));
    await setDraftDamage(db, files, damaged.id, input, [photo()], later(10));
    const end = later(90);

    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1', now: end });

    expect(await db.parcel.get(damaged.id)).toMatchObject({
      damage: 'ouvert',
      damageNote: 'Scotch arraché',
      damageNotify: true,
      damageCarrierReserve: true,
      damagedAt: later(10),
    });
    const [event] = await db.event.toArray();
    expect(event).toMatchObject({
      entityId: damaged.id,
      type: 'parcel.damaged',
      at: later(10),
      actorId: 'agent-1',
      detail: { reason: 'ouvert', photos: 1 },
    });
    const photos = await db.photo
      .where('parcelId')
      .equals(damaged.id)
      .toArray();
    expect(photos.map((row) => row.kind).sort()).toEqual([
      'dommage',
      'etiquette',
    ]);
    expect(files.files.size).toBe(2);
  });

  it('writes the sender on the parcel when it is sure or to verify, not a guess', async () => {
    const known = senderRow();
    await db.sender.add(known);
    const batch = await openBatch(db, NOW);
    const sure = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, sure.id, {
      reading: 'read',
      sender: {
        name: 'Metalworks SpA',
        id: known.id,
        level: 'sure',
        source: 'learned',
        account: { carrier: 'ups', accountNumber: 'E6344W' },
      },
    });
    const doubtful = await addDraft(db, files, batch.id, photo(), later(1));
    await updateDraft(db, doubtful.id, {
      reading: 'read',
      sender: {
        name: 'Atelier Tissage Nord',
        id: 'sender-2',
        level: 'to-verify',
        source: 'learned',
        account: null,
      },
    });
    const guessed = await addDraft(db, files, batch.id, photo(), later(2));
    await updateDraft(db, guessed.id, {
      reading: 'read',
      sender: {
        name: 'PEARL GmbH',
        id: null,
        level: 'none',
        source: 'ocr',
        account: null,
      },
    });

    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1' });

    expect(await db.parcel.get(sure.id)).toMatchObject({
      senderId: known.id,
      senderName: 'Metalworks SpA',
    });
    expect(await db.parcel.get(doubtful.id)).toMatchObject({
      senderId: 'sender-2',
      senderName: 'Atelier Tissage Nord',
    });
    expect(await db.parcel.get(guessed.id)).toMatchObject({
      senderId: null,
      senderName: null,
    });
  });

  it('learns a sender a code named, with its carrier account, ahead of the parcels', async () => {
    const batch = await openBatch(db, NOW);
    const first = await addDraft(db, files, batch.id, photo(), NOW);
    const second = await addDraft(db, files, batch.id, photo(), later(1));
    for (const draft of [first, second]) {
      await updateDraft(db, draft.id, {
        reading: 'read',
        sender: {
          name: 'Metalworks S.p.A.',
          id: null,
          level: 'sure',
          source: '2d',
          account: { carrier: 'UPS', accountNumber: 'e63 44w' },
        },
      });
    }
    const end = later(90);

    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1', now: end });

    const senders = await db.sender.toArray();
    expect(senders).toHaveLength(1);
    expect(senders[0]).toMatchObject({
      displayName: 'Metalworks S.p.A.',
      nameNorm: 'metalworks spa',
      seenCount: 2,
      lastSeenAt: end,
    });
    const accounts = await db.senderAccount.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      carrier: 'ups',
      accountNumber: 'E6344W',
      senderId: senders[0]?.id,
      confirmations: 2,
    });
    expect(await db.parcel.get(first.id)).toMatchObject({
      senderId: senders[0]?.id,
      senderName: 'Metalworks S.p.A.',
    });
    const queued = await db.outbox.orderBy('seq').toArray();
    expect(queued.map((op) => op.entity)).toEqual([
      'sender',
      'sender_account',
      'batch',
      'parcel',
      'parcel',
    ]);
  });

  it('counts a sender the dictionary found once more, and confirms its account', async () => {
    const known = senderRow({ seenCount: 4, lastSeenAt: NOW });
    await db.sender.add(known);
    const account = senderAccountRow({
      senderId: known.id,
      confirmations: 2,
    });
    await db.senderAccount.add(account);
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, draft.id, {
      reading: 'read',
      sender: {
        name: known.displayName,
        id: known.id,
        level: 'sure',
        source: 'learned',
        account: { carrier: 'ups', accountNumber: 'E6344W' },
      },
    });
    const end = later(90);

    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1', now: end });

    expect(await db.sender.count()).toBe(1);
    expect(await db.sender.get(known.id)).toMatchObject({
      seenCount: 5,
      lastSeenAt: end,
    });
    expect(await db.senderAccount.count()).toBe(1);
    expect(await db.senderAccount.get(account.id)).toMatchObject({
      confirmations: 3,
    });
  });

  it('learns nothing from a sender still to verify, nor an account another sender owns', async () => {
    const other = senderRow({ displayName: 'Autre', nameNorm: 'autre' });
    await db.sender.add(other);
    const account = senderAccountRow({ senderId: other.id, confirmations: 1 });
    await db.senderAccount.add(account);
    const batch = await openBatch(db, NOW);
    const doubtful = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, doubtful.id, {
      reading: 'read',
      sender: {
        name: 'Atelier Tissage Nord',
        id: null,
        level: 'to-verify',
        source: 'learned',
        account: null,
      },
    });
    const owned = await addDraft(db, files, batch.id, photo(), later(1));
    await updateDraft(db, owned.id, {
      reading: 'read',
      sender: {
        name: 'Metalworks SpA',
        id: null,
        level: 'sure',
        source: '2d',
        account: { carrier: 'ups', accountNumber: 'E6344W' },
      },
    });

    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1' });

    expect(
      (await db.sender.toArray()).map((row) => row.displayName).sort(),
    ).toEqual(['Autre', 'Metalworks SpA']);
    expect(await db.senderAccount.get(account.id)).toMatchObject({
      senderId: other.id,
      confirmations: 1,
    });
    expect(await db.senderAccount.count()).toBe(1);
    expect(await db.parcel.get(doubtful.id)).toMatchObject({
      senderId: null,
      senderName: 'Atelier Tissage Nord',
    });
  });

  it('drops a sure sender whose row was deleted meanwhile', async () => {
    const gone = senderRow({ deletedAt: NOW });
    await db.sender.add(gone);
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, draft.id, {
      reading: 'read',
      sender: {
        name: gone.displayName,
        id: gone.id,
        level: 'sure',
        source: 'learned',
        account: { carrier: 'ups', accountNumber: 'E6344W' },
      },
    });

    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1' });

    expect(await db.parcel.get(draft.id)).toMatchObject({
      senderId: null,
      senderName: gone.displayName,
    });
    expect(await db.sender.count()).toBe(1);
    expect(await db.senderAccount.count()).toBe(0);
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
