/** OPFS directory of the photos, under the origin's root. */
export const PHOTOS_DIRECTORY = 'photos';

export type SaveRequest = { id: number; name: string; blob: Blob };

export type SaveReply =
  | { id: number; ok: true }
  | { id: number; ok: false; error: { name: string; message: string } };
