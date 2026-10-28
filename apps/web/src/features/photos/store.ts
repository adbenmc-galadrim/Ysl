import type {
  CourrierDatabase,
  LocalPhoto,
  PhotoKind,
} from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';
import { PHOTOS_DIRECTORY } from '#/features/photos/protocol';
import { sha256Hex } from '#/features/photos/sha256';

export type PhotoInput = {
  id: string;
  parcelId: string | null;
  kind: PhotoKind;
  blob: Blob;
  width: number;
  height: number;
};

/** A photo written before its row is tolerable; the sweep gives it this long. */
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;

export function photoFileName(id: string): string {
  return `${id}.jpg`;
}

function pathOf(fileName: string): string {
  return `${PHOTOS_DIRECTORY}/${fileName}`;
}

export function photoPath(id: string): string {
  return pathOf(photoFileName(id));
}

/**
 * The file first, the row second (S4): a row without its file is a loss, a
 * file without its row is swept later. The photo never leaves the device
 * (D8), so nothing is queued for the server.
 */
export async function savePhoto(
  db: CourrierDatabase,
  files: PhotoFiles,
  input: PhotoInput,
  now = new Date(),
): Promise<LocalPhoto> {
  const name = photoFileName(input.id);
  await files.save(name, input.blob);
  const row: LocalPhoto = {
    id: input.id,
    parcelId: input.parcelId,
    kind: input.kind,
    path: photoPath(input.id),
    sha256: await sha256Hex(input.blob),
    width: input.width,
    height: input.height,
    bytes: input.blob.size,
    createdAt: now,
  };
  await db.photo.put(row);
  return row;
}

export function readPhoto(files: PhotoFiles, photo: LocalPhoto): Promise<Blob> {
  return files.read(photoFileName(photo.id));
}

/** The row first, so a crash in between leaves an orphan file, not a lost row. */
export async function deletePhoto(
  db: CourrierDatabase,
  files: PhotoFiles,
  id: string,
): Promise<void> {
  await db.photo.delete(id);
  await files.remove(photoFileName(id));
}

/**
 * Launch check (S4): removes the files no row points to — a photo or a
 * handover's proof — once they are old enough not to be one whose row is
 * still on its way.
 */
export async function sweepOrphanPhotos(
  db: CourrierDatabase,
  files: PhotoFiles,
  now = new Date(),
  graceMs = ORPHAN_GRACE_MS,
): Promise<string[]> {
  const stored = await files.list();
  if (!stored.length) return [];
  const [photos, proofs] = await Promise.all([
    db.photo.toArray(),
    db.handoverProof.toArray(),
  ]);
  const known = new Set([...photos, ...proofs].map((row) => row.path));
  const removed: string[] = [];
  for (const file of stored) {
    if (known.has(pathOf(file.name))) continue;
    if (now.getTime() - file.lastModified < graceMs) continue;
    await files.remove(file.name);
    removed.push(file.name);
  }
  return removed;
}
