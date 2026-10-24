import type { CourrierDatabase } from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';

/**
 * Empties the device: every local table in one transaction, then the photo
 * files. Rows first, so a crash in between leaves orphan files (swept at the
 * next launch), never rows without their photos. Called only once the
 * outbox is empty: what is not on the server would be lost.
 */
export async function clearLocalData(
  db: CourrierDatabase,
  files: PhotoFiles | null,
): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
  if (!files) return;
  const stored = await files.list();
  await Promise.all(stored.map((file) => files.remove(file.name)));
}
