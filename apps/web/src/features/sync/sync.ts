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

let stop: (() => void) | null = null;

/**
 * Starts the triggers once, for a signed-in session: at once, when the
 * network comes back, when the app returns to the front, after every local
 * commit, and on a timer while visible. Background Sync does not exist on
 * iOS, so nothing runs while the app is closed. `stopSync` undoes it all at
 * sign-out.
 */
export function startSync(): void {
  if (stop) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onOnline = () => void syncNow();
  const onOffline = () => syncEngine.markOffline();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow();
  };
  const interval = setInterval(onVisible, INTERVAL_MS);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  const unsubscribe = onLocalCommit(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), AFTER_COMMIT_MS);
  });
  stop = () => {
    clearInterval(interval);
    clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    unsubscribe();
  };
  void syncNow();
}

export function stopSync(): void {
  stop?.();
  stop = null;
  syncEngine.reset();
}
