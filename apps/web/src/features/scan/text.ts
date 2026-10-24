import { recipientFromLines } from '@repo/ocr/recipient';
import { OcrReader, type OcrResult } from '@repo/ocr/worker';
import { updateDraft } from '#/features/batch/store';
import type { CourrierDatabase } from '#/features/db/schema';
import { modelsReady } from '#/features/offline/models-state';

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
): Promise<ReadText> {
  const running = inFlight.get(draftId);
  if (running) return running;
  const reading = (
    ready ? read(db, draftId, blob, ocr) : skip(db, draftId)
  ).finally(() => inFlight.delete(draftId));
  inFlight.set(draftId, reading);
  return reading;
}

async function skip(db: CourrierDatabase, draftId: string): Promise<ReadText> {
  const kept = await updateDraft(db, draftId, { ocrState: 'skipped' }).catch(
    () => false,
  );
  return { draftId, ocrName: null, kept, failed: false };
}

async function read(
  db: CourrierDatabase,
  draftId: string,
  blob: Blob,
  ocr: TextReader,
): Promise<ReadText> {
  try {
    const result: OcrResult = await ocr.recognize(blob);
    const ocrName = recipientFromLines(result.lines);
    const kept = await updateDraft(db, draftId, {
      ocrState: 'done',
      ocrName,
      ocrLines: result.lines,
    });
    return { draftId, ocrName, kept, failed: false };
  } catch {
    const kept = await updateDraft(db, draftId, { ocrState: 'failed' }).catch(
      () => false,
    );
    return { draftId, ocrName: null, kept, failed: true };
  }
}
