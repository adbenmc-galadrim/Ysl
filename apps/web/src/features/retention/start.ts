import { db } from '#/features/db/database';
import { hasPhotoStorage, photoFiles } from '#/features/photos/opfs';
import { createLocalPurgeScheduler } from '#/features/retention/schedule';
import { startCompanySettings } from '#/features/settings/use-company-settings';
import { syncEngine } from '#/features/sync/sync';

export const localPurge = createLocalPurgeScheduler({
  db,
  files: () => (hasPhotoStorage() ? photoFiles : null),
});

/** The local purge at launch, then after each synchronisation that went through. */
export function startLocalPurge(): void {
  startCompanySettings();
  void localPurge.schedule({ force: true });
  let previous = syncEngine.getSnapshot().status;
  syncEngine.subscribe(() => {
    const { status } = syncEngine.getSnapshot();
    if (previous === 'syncing' && status === 'idle') {
      void localPurge.schedule();
    }
    previous = status;
  });
}
