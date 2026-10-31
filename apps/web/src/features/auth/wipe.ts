import { clearCompanySuspended } from '#/features/auth/company-suspension';
import { forgetSession } from '#/features/auth/session-cache';
import { clearLocalData } from '#/features/db/clear';
import { db } from '#/features/db/database';
import { resetOfflinePrep } from '#/features/offline/prep';
import { forgetPrepared } from '#/features/offline/prepared';
import { hasPhotoStorage, photoFiles } from '#/features/photos/opfs';
import { stopSync } from '#/features/sync/sync';

/**
 * Everything the session left on the device: the kept session, the offline
 * preparation, the synchronisation, Dexie and OPFS.
 */
export async function wipeLocalData(): Promise<void> {
  forgetSession(localStorage);
  clearCompanySuspended(localStorage);
  forgetPrepared(localStorage);
  resetOfflinePrep();
  await stopSync();
  try {
    await clearLocalData(db, hasPhotoStorage() ? photoFiles : null);
  } catch (cause) {
    console.warn('Local data was not fully cleared', cause);
  }
}
