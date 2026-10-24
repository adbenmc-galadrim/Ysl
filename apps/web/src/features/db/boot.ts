import { db } from '#/features/db/database';
import { requestPersistentStorage } from '#/features/db/storage';
import { hasPhotoStorage, photoFiles } from '#/features/photos/opfs';
import { sweepOrphanPhotos } from '#/features/photos/store';

/** Launch duties of the local store, none of which may stop the app. */
export async function bootLocalStore(): Promise<void> {
  const persisted = await requestPersistentStorage();
  if (persisted === false) console.warn('Persistent storage was denied');
  if (!hasPhotoStorage()) return;
  try {
    await sweepOrphanPhotos(db, photoFiles);
  } catch (error) {
    console.warn('Photo sweep failed', error);
  }
}
