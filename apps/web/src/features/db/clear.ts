import type { CourrierDatabase } from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';

/**
 * Empties the device: every local table in one transaction, then the photo
 * files. Rows first, so a crash in between leaves orphan files (swept at the
 * next launch), never rows without their photos. Sign-out calls it once
 * the outbox is empty; "Effacer les données de cet iPhone" may call it with
 * changes still queued, after the admin was told they would be lost.
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
