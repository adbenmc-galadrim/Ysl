import { recipientFromLines } from '@repo/ocr/recipient';
import { senderFromLines } from '@repo/ocr/sender';
import { OcrReader, type OcrResult } from '@repo/ocr/worker';
import {
  firstPiece,
  pieceOfAnnex,
  type PieceRead,
} from '#/features/batch/pieces';
import { updateDraft } from '#/features/batch/store';
import { annexOf, type DraftAnnex } from '#/features/scan/annex';
import type {
  CourrierDatabase,
  DraftOcrLine,
  DraftParcel,
  DraftSender,
} from '#/features/db/schema';
import { modelsReady } from '#/features/offline/models-state';
import { resolveSender } from '#/features/scan/sender';

export type TextReader = Pick<OcrReader, 'recognize'>;

let reader: OcrReader | undefined;

/**
 * The OCR Worker behind the scan screen, started on first use and kept for
 * the session like the barcode one: a text in flight when the agent leaves
 * the screen still lands in its draft.
 */
export function ocrReader(): OcrReader {
  reader ??= new OcrReader();
  return reader;
}

export type ReadText = {
  draftId: string;
  ocrName: string | null;
  /** The draft's sender after the text: from its `FROM` block, else what the codes gave, skipped or failed included. */
  sender: DraftSender | null;
  /** The annex fields once the text is read with the codes; null when it is not. */
  annex: DraftAnnex | null;
  /** The piece the text announced on a draft no code had tied to others. */
  piece: PieceRead | null;
  /** Every line read, for a held draft that is not in the database to keep them. */
  ocrLines: DraftOcrLine[];
  /** False when the draft was undone meanwhile: nothing to show. */
  kept: boolean;
  /** True when the OCR failed; the draft keeps what the codes gave. */
  failed: boolean;
};

/** One reading per draft at a time: a screen remounted mid-OCR joins it. */
const inFlight = new Map<string, Promise<ReadText>>();

/**
 * Reads the printed text of one stored photo, after the codes: the lines
 * land on the draft with the recipient they suggest. Never throws, and a
 * failure never touches `reading`: the codes already said what they could.
 * Until the preparation has every reader file on the device, the text is
 * skipped rather than fetched on the spot: the draft keeps the codes.
 */
export function readText(
  db: CourrierDatabase,
  draftId: string,
  blob: Blob,
  ocr: TextReader = ocrReader(),
  ready: boolean = modelsReady(),
  held?: DraftParcel,
): Promise<ReadText> {
  const key = held ? `${draftId}\u0000held` : draftId;
  const running = inFlight.get(key);
  if (running) return running;
  const reading = (
    ready ? read(db, draftId, blob, ocr, held) : skip(db, draftId)
  ).finally(() => inFlight.delete(key));
  inFlight.set(key, reading);
  return reading;
}

/** The sender the draft already holds: what the screen keeps when the text says nothing. */
async function currentSender(
  db: CourrierDatabase,
  draftId: string,
): Promise<DraftSender | null> {
  const draft = await db.draftParcel.get(draftId).catch(() => undefined);
  return draft?.sender ?? null;
}

async function skip(db: CourrierDatabase, draftId: string): Promise<ReadText> {
  const sender = await currentSender(db, draftId);
  const kept = await updateDraft(db, draftId, { ocrState: 'skipped' }).catch(
    () => false,
  );
  return {
    draftId,
    ocrName: null,
    sender,
    annex: null,
    piece: null,
    ocrLines: [],
    kept,
    failed: false,
  };
}

/**
 * The `FROM` block only speaks when the codes did not settle the sender:
 * a name a code gave, or an account the dictionary knows, stays.
 */
async function senderWithText(
  db: CourrierDatabase,
  draftId: string,
  lines: OcrResult['lines'],
): Promise<DraftSender | null | undefined> {
  const draft = await db.draftParcel.get(draftId);
  if (!draft) return undefined;
  const current = draft.sender ?? null;
  if (current?.level === 'sure') return current;
  const ocrName = senderFromLines(lines);
  if (ocrName === null) return current;
  return resolveSender(db, draft.symbols, ocrName).catch(() => current);
}

/**
 * A draft held as a duplicate (F10) is out of the database: its text is read
 * from the copy the screen keeps, and nothing is written, not even on the
 * copy. « Ajouter quand même » reads the text again, as a draft of the
 * batch, so the reading of a held draft never stands in for that one.
 */
async function read(
  db: CourrierDatabase,
  draftId: string,
  blob: Blob,
  ocr: TextReader,
  held?: DraftParcel,
): Promise<ReadText> {
  const started = performance.now();
  try {
    const result: OcrResult = await ocr.recognize(blob);
    const ocrMs = Math.round(performance.now() - started);
    const ocrName = recipientFromLines(result.lines);
    const sender = await senderWithText(db, draftId, result.lines);
    const draft = held ?? (await db.draftParcel.get(draftId));
    const annex = draft ? annexOf(draft.symbols, result.lines) : null;
    const piece =
      draft && !draft.pieces ? pieceOfAnnex(annex, draft.trackingNorm) : null;
    const kept = held
      ? true
      : await updateDraft(db, draftId, {
          ocrState: 'done',
          ocrName,
          ocrLines: result.lines,
          ...(sender === undefined ? {} : { sender }),
          ...(annex === null ? {} : { annex }),
          ...(piece === null ? {} : { pieces: firstPiece(piece) }),
          durations: { ...draft?.durations, ocrMs },
        });
    return {
      draftId,
      ocrName,
      sender: sender ?? null,
      annex,
      piece,
      ocrLines: result.lines,
      kept,
      failed: false,
    };
  } catch {
    const kept = await updateDraft(db, draftId, { ocrState: 'failed' }).catch(
      () => false,
    );
    return {
      draftId,
      ocrName: null,
      sender: await currentSender(db, draftId),
      annex: null,
      piece: null,
      ocrLines: [],
      kept,
      failed: true,
    };
  }
}
