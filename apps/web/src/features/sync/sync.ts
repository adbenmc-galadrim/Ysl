import { onLocalCommit } from '#/features/db/commit';
import { db } from '#/features/db/database';
import { createSyncEngine } from '#/features/sync/engine';
import { queryClient } from '#/lib/query-client';
import { trpcClient } from '#/lib/trpc';

const INTERVAL_MS = 60_000;
const AFTER_COMMIT_MS = 500;

/** The one engine of this device, wired to the API and the local database. */
export const syncEngine = createSyncEngine({
  db,
  push: (input) => trpcClient.sync.push.mutate(input),
  pull: (input) => trpcClient.sync.pull.query(input),
  onUnauthorized: () => {
    void queryClient.invalidateQueries({ queryKey: ['session'] });
  },
});

export const syncNow = () => syncEngine.syncNow();

let started = false;

/**
 * Starts the triggers once, for a signed-in session: at once, when the
 * network comes back, when the app returns to the front, after every local
 * commit, and on a timer while visible. Background Sync does not exist on
 * iOS, so nothing runs while the app is closed.
 */
export function startSync(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => syncEngine.markOffline());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, INTERVAL_MS);
  onLocalCommit(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), AFTER_COMMIT_MS);
  });
  void syncNow();
}
