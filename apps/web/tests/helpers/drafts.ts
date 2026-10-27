import type { DraftParcel } from '#/features/db/schema';

export const DRAFT_AT = new Date('2026-10-20T09:00:00Z');

/** A draft parcel of the batch `b`, read, with nothing on it yet. */
export const draftOf = (overrides: Partial<DraftParcel>): DraftParcel => ({
  id: 'd',
  batchId: 'b',
  createdAt: DRAFT_AT,
  photoId: null,
  reading: 'read',
  carrier: null,
  tracking: null,
  trackingNorm: null,
  readName: null,
  symbols: [],
  ocrState: 'done',
  ocrName: null,
  ocrLines: [],
  ...overrides,
});

/** An OCR line of the 1 600 px working image; only its text matters here. */
export const line = (text: string) => ({
  text,
  box: { x: 0, y: 0, width: 100, height: 20 },
  score: 0.9,
});
