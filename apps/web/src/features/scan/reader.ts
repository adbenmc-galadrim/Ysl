import type { DecodeResult } from '@repo/barcode/worker';
import { listDrafts, updateDraft } from '#/features/batch/store';
import type {
  CourrierDatabase,
  DraftParcel,
  DraftSymbol,
} from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';
import type { DecodeQueue } from '#/features/scan/decode-queue';
import { missingFormats } from '#/features/scan/expected-formats';
import { extractTracking, recipientInCodes } from '#/features/scan/extract';

export type Symbols = DecodeResult['symbols'];

export type Reading = {
  draftId: string;
  symbols: Symbols;
  /** False when the draft was undone meanwhile: nothing to show. */
  kept: boolean;
  /** True when the Worker failed; the draft is marked so. */
  failed: boolean;
};

const bare = (symbols: Symbols): DraftSymbol[] =>
  symbols.map(({ format, text }) => ({ format, text }));

/** The second pass may read a symbol the first already had. */
export const merge = (first: Symbols, second: Symbols): Symbols => {
  const seen = new Set(first.map((s) => `${s.format}\u0000${s.text}`));
  return [
    ...first,
    ...second.filter((s) => !seen.has(`${s.format}\u0000${s.text}`)),
  ];
};

/** Drafts whose reading is in flight, across screens. */
const inFlight = new Set<string>();

/** Every shot or recovery still running, so "Terminer" can wait for them. */
const work = new Set<Promise<unknown>>();

export function trackWork<T>(promise: Promise<T>): Promise<T> {
  work.add(promise);
  void promise.finally(() => work.delete(promise)).catch(() => undefined);
  return promise;
}

/** Resolves once nothing is on its way any more, this screen or a former one. */
export async function settled(): Promise<void> {
  while (work.size) await Promise.allSettled([...work]);
}

/**
 * Reads one shot under a queue slot already acquired: the cascade, then a
 * second pass for the carrier's missing symbols. Owns both bitmaps and the
 * slot, and never throws: a Worker failure is written on the draft.
 */
export async function readDraft(
  db: CourrierDatabase,
  queue: DecodeQueue,
  draftId: string,
  bitmap: ImageBitmap,
  clone: ImageBitmap,
): Promise<Reading> {
  inFlight.add(draftId);
  let spare: ImageBitmap | undefined = clone;
  try {
    let { symbols } = await queue.decode(bitmap);
    const missing = missingFormats(
      extractTracking(symbols)?.context ?? null,
      symbols,
    );
    if (missing.length) {
      const again = await queue.decode(spare, { expect: missing });
      spare = undefined;
      symbols = merge(symbols, again.symbols);
    }
    const found = extractTracking(symbols);
    const kept = await updateDraft(db, draftId, {
      reading: symbols.length ? 'read' : 'unreadable',
      carrier: found?.carrier ?? null,
      tracking: found?.tracking ?? null,
      trackingNorm: found?.trackingNorm ?? null,
      readName: recipientInCodes(symbols),
      symbols: bare(symbols),
    });
    return { draftId, symbols, kept, failed: false };
  } catch {
    const kept = await updateDraft(db, draftId, { reading: 'failed' }).catch(
      () => false,
    );
    return { draftId, symbols: [], kept, failed: true };
  } finally {
    spare?.close();
    queue.release();
    inFlight.delete(draftId);
  }
}

/**
 * Reads the printed text of a draft's stored photo, after its codes, whether
 * they landed or failed: a Worker of codes that crashed says nothing of the
 * photo. Not awaited: "Terminer" waits for the codes, never for the text.
 */
export type TextStep = (draftId: string, blob: Blob) => Promise<unknown>;

const noText: TextStep = () => Promise.resolve();

/**
 * A batch picked up after the app died mid-reading: the drafts still on
 * "pending" are read again from their stored photo, or marked failed; the
 * ones whose codes landed but not their text get their text read.
 */
export async function recoverPending(
  db: CourrierDatabase,
  files: PhotoFiles,
  queue: DecodeQueue,
  batchId: string,
  toBitmap: (blob: Blob) => Promise<ImageBitmap> = (blob) =>
    createImageBitmap(blob),
  text: TextStep = noText,
): Promise<void> {
  const drafts = await listDrafts(db, batchId);
  for (const draft of drafts) {
    if (inFlight.has(draft.id)) continue;
    if (draft.reading === 'pending') {
      await recoverReading(db, files, queue, draft, toBitmap, text);
    } else if (draft.photoId && draft.ocrState === 'pending') {
      await recoverText(db, files, draft, text);
    }
  }
}

async function recoverReading(
  db: CourrierDatabase,
  files: PhotoFiles,
  queue: DecodeQueue,
  draft: DraftParcel,
  toBitmap: (blob: Blob) => Promise<ImageBitmap>,
  text: TextStep,
): Promise<void> {
  inFlight.add(draft.id);
  let slot = false;
  let bitmap: ImageBitmap | undefined;
  try {
    const photo = draft.photoId ? await db.photo.get(draft.photoId) : null;
    if (!photo) throw new Error('No photo to read again');
    await queue.acquire();
    slot = true;
    const blob = await readPhoto(files, photo);
    bitmap = await toBitmap(blob);
    const clone = await toBitmap(blob);
    const first = bitmap;
    slot = false;
    bitmap = undefined;
    const { kept } = await readDraft(db, queue, draft.id, first, clone);
    if (kept) void text(draft.id, blob);
  } catch {
    if (slot) queue.release();
    bitmap?.close();
    await updateDraft(db, draft.id, {
      reading: 'failed',
      ocrState: 'skipped',
    }).catch(() => undefined);
  } finally {
    inFlight.delete(draft.id);
  }
}

async function recoverText(
  db: CourrierDatabase,
  files: PhotoFiles,
  draft: DraftParcel,
  text: TextStep,
): Promise<void> {
  inFlight.add(draft.id);
  try {
    const photo = draft.photoId ? await db.photo.get(draft.photoId) : null;
    if (!photo) throw new Error('No photo to read again');
    void text(draft.id, await readPhoto(files, photo));
  } catch {
    await updateDraft(db, draft.id, { ocrState: 'skipped' }).catch(
      () => undefined,
    );
  } finally {
    inFlight.delete(draft.id);
  }
}
