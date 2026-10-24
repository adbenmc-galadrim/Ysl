import type { DraftParcel } from '#/features/db/schema';

/** How long "Annuler" stays once the reading has landed (F08: a 5 s toast). */
export const UNDO_WINDOW_MS = 5_000;

/**
 * The draft "Annuler" would take back, and until when; `newest` remembers
 * the youngest draft the screen has seen, window open or closed, so an
 * older one coming back is told apart. Open-ended while the draft reads:
 * the agent cannot judge a parcel the screen has not described yet.
 */
export type UndoWindow = {
  draftId: string;
  reading: DraftParcel['reading'];
  newest: number;
  until: number;
} | null;

/**
 * "Annuler" is the 5 s toast of the brief in the band's clothes: it only
 * concerns the parcel that just arrived. The window follows the batch as the
 * screen renders, so it is pure: a draft younger than any the screen has
 * seen (or than `since`, when the screen opened on a batch already filled)
 * starts the clock once its reading lands; the same draft in the same state
 * keeps its clock, so a re-render never extends it; an older draft coming
 * back — the one before an undone parcel — gets a closed window, that way
 * lies the list of the batch. Returns `prev` itself when nothing moved.
 */
export function undoWindow(
  prev: UndoWindow,
  last: Pick<DraftParcel, 'id' | 'reading' | 'createdAt'> | undefined,
  now: number,
  since: number,
): UndoWindow {
  if (!last) return null;
  if (prev?.draftId === last.id && prev.reading === last.reading) return prev;
  const createdAt = last.createdAt.getTime();
  const newest = prev?.newest ?? since;
  const base = { draftId: last.id, reading: last.reading };
  if (prev?.draftId !== last.id && createdAt < newest) {
    return { ...base, newest, until: 0 };
  }
  const until = last.reading === 'pending' ? Infinity : now + UNDO_WINDOW_MS;
  return { ...base, newest: Math.max(newest, createdAt), until };
}

export function canUndo(window: UndoWindow, now: number): boolean {
  return window !== null && now < window.until;
}
