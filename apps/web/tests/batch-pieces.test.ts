import 'fake-indexeddb/auto';
import { EOT, GS, parseCode, RS } from '@repo/contract/codes';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  attachPiece,
  findPieceGroup,
  firstPiece,
  pieceOf,
  pieceOfAnnex,
} from '#/features/batch/pieces';
import {
  addDraft,
  countDrafts,
  discardBatch,
  finishBatch,
  openBatch,
  undoLast,
  updateDraft,
} from '#/features/batch/store';
import type { CourrierDatabase } from '#/features/db/schema';
import { NOW, openTestDatabase } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

/** A UPS MaxiCode: pieces and shipment id where the carrier prints them. */
const maxicode = (pieces: string, shipmentId = '') =>
  `[)>${RS}01${GS}9675007${GS}250${GS}004${GS}1Z99230623${GS}UPSN${GS}E6344W${GS}296${GS}${shipmentId}${GS}${pieces}${GS}3${GS}N${GS}${GS}PARIS${RS}${EOT}`;

const photo = () => ({
  blob: new Blob(['etiquette'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

let db: CourrierDatabase;
let files: MemoryFiles;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
});

describe('pieceOfAnnex', () => {
  const annex = (index: number, total: number) => ({
    pieces: { index, total, level: 'to-verify' as const },
    weightKg: null,
    service: null,
    reference: null,
  });

  it('ties the boxes the text announces by the tracking number', () => {
    expect(pieceOfAnnex(annex(2, 3), '1Z99230623')).toEqual({
      index: 2,
      total: 3,
      key: '1Z99230623',
    });
  });

  it('is no piece without a number, a single box, or no text', () => {
    expect(pieceOfAnnex(annex(2, 3), null)).toBeNull();
    expect(pieceOfAnnex(annex(1, 1), '1Z99230623')).toBeNull();
    expect(pieceOfAnnex(null, '1Z99230623')).toBeNull();
  });
});

describe('pieceOf', () => {
  it('tells the pieces of a parcel in several boxes, keyed by the shipment', () => {
    const parsed = parseCode(maxicode('2/3', 'SHIP42'), 'MaxiCode');
    expect(pieceOf(parsed, '1Z99230623')).toEqual({
      index: 2,
      total: 3,
      key: 'ups:SHIP42',
    });
  });

  it('falls back on the tracking number when the code has no shipment id', () => {
    const parsed = parseCode(maxicode('1/2'), 'MaxiCode');
    expect(pieceOf(parsed, '1Z99230623')).toEqual({
      index: 1,
      total: 2,
      key: '1Z99230623',
    });
  });

  it('is nothing for a single parcel, a code without pieces, or nothing to tie the pieces', () => {
    expect(pieceOf(parseCode(maxicode('1/1'), 'MaxiCode'), '1Z99230623')).toBe(
      null,
    );
    expect(pieceOf(parseCode(maxicode(''), 'MaxiCode'), '1Z99230623')).toBe(
      null,
    );
    expect(pieceOf(parseCode(maxicode('1/2'), 'MaxiCode'), null)).toBe(null);
    expect(pieceOf(null, '1Z99230623')).toBe(null);
  });
});

describe('findPieceGroup', () => {
  it('finds the oldest older draft of the batch with the same key, not a younger one or another batch', async () => {
    const batch = await openBatch(db, NOW);
    const older = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, older.id, {
      pieces: firstPiece({ index: 1, total: 3, key: 'ups:SHIP42' }),
    });
    const other = await addDraft(db, files, batch.id, null, later(1));
    await updateDraft(db, other.id, {
      pieces: firstPiece({ index: 1, total: 2, key: 'ups:OTHER' }),
    });
    const piece = await addDraft(db, files, batch.id, null, later(2));
    const younger = await addDraft(db, files, batch.id, null, later(3));
    await updateDraft(db, younger.id, {
      pieces: firstPiece({ index: 3, total: 3, key: 'ups:SHIP42' }),
    });
    const elsewhere = await addDraft(db, files, 'other-batch', null, NOW);
    await updateDraft(db, elsewhere.id, {
      pieces: firstPiece({ index: 2, total: 3, key: 'ups:SHIP42' }),
    });

    const group = await findPieceGroup(db, piece, 'ups:SHIP42');

    expect(group?.id).toBe(older.id);
    expect(await findPieceGroup(db, piece, 'ups:NONE')).toBeUndefined();
  });
});

describe('attachPiece', () => {
  it('gathers the piece under its parcel: number, photo, and one draft fewer', async () => {
    const batch = await openBatch(db, NOW);
    const group = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, group.id, {
      pieces: firstPiece({ index: 1, total: 3, key: 'ups:SHIP42' }),
    });
    const piece = await addDraft(db, files, batch.id, photo(), later(5));

    const joined = await attachPiece(db, group.id, piece, 3);

    expect(joined?.pieces).toEqual({
      total: 3,
      read: [1, 3],
      key: 'ups:SHIP42',
      photoIds: [piece.photoId],
    });
    expect(await countDrafts(db, batch.id)).toBe(1);
    expect(await db.draftParcel.get(piece.id)).toBeUndefined();
    expect(await db.photo.get(piece.photoId ?? '')).toBeDefined();
    expect(await db.draftParcel.get(group.id)).toMatchObject({
      pieces: { read: [1, 3] },
    });
  });

  it('does not count the same number twice', async () => {
    const batch = await openBatch(db, NOW);
    const group = await addDraft(db, files, batch.id, null, NOW);
    await updateDraft(db, group.id, {
      pieces: firstPiece({ index: 2, total: 3, key: 'k' }),
    });
    const piece = await addDraft(db, files, batch.id, null, later(1));

    const joined = await attachPiece(db, group.id, piece, 2);

    expect(joined?.pieces?.read).toEqual([2]);
  });

  it('leaves the piece as a parcel of its own when the group was undone meanwhile', async () => {
    const batch = await openBatch(db, NOW);
    const piece = await addDraft(db, files, batch.id, null, NOW);

    expect(await attachPiece(db, 'gone', piece, 2)).toBeUndefined();
    expect(await db.draftParcel.get(piece.id)).toBeDefined();
  });
});

describe('the pieces follow their parcel', () => {
  const grouped = async () => {
    const batch = await openBatch(db, NOW);
    const group = await addDraft(db, files, batch.id, photo(), NOW);
    await updateDraft(db, group.id, {
      reading: 'read',
      carrier: 'UPS',
      tracking: '1ZE6344W0499230622',
      trackingNorm: '1ZE6344W0499230622',
      readName: 'Camille Morel',
      pieces: firstPiece({ index: 1, total: 3, key: 'ups:SHIP42' }),
    });
    const piece = await addDraft(db, files, batch.id, photo(), later(5));
    await attachPiece(db, group.id, piece, 2);
    return { batch, group, piece };
  };

  it('"Annuler" takes the pieces\' photos out with the parcel', async () => {
    const { batch } = await grouped();
    expect(files.files.size).toBe(2);

    await undoLast(db, files, batch.id);

    expect(await db.photo.count()).toBe(0);
    expect(files.files.size).toBe(0);
  });

  it('"Abandonner" does too', async () => {
    const { batch } = await grouped();

    await discardBatch(db, files, batch.id);

    expect(await db.photo.count()).toBe(0);
    expect(files.files.size).toBe(0);
  });

  it('"Terminer" writes the pieces received over the pieces announced, photos attached', async () => {
    const { batch, group, piece } = await grouped();

    const ids = await finishBatch(db, { batchId: batch.id, agentId: 'a' });

    expect(ids).toEqual([group.id]);
    expect(await db.parcel.get(group.id)).toMatchObject({
      status: 'recu',
      pieceN: 2,
      pieceTotal: 3,
    });
    expect(await db.photo.get(group.photoId ?? '')).toMatchObject({
      parcelId: group.id,
    });
    expect(await db.photo.get(piece.photoId ?? '')).toMatchObject({
      parcelId: group.id,
    });
  });
});
