import { onLocalCommit } from '#/features/db/commit';
import { db } from '#/features/db/database';
import { settleDeliveryConflicts } from '#/features/handover/conflicts';
import { announceHandover } from '#/features/handover/done-toast';
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
  afterPull: async () => {
    for (const conflict of await settleDeliveryConflicts(db)) {
      announceHandover({
        kind: 'conflict',
        firstName: conflict.recipientName?.trim().split(/\s+/)[0] ?? null,
        byMe: conflict.byMe,
      });
    }
  },
});

/** The automatic triggers respect the back-off; a tap or the network coming back do not. */
export const syncNow = (options?: { force?: boolean }) =>
  syncEngine.syncNow(options);

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
  const onOnline = () => void syncNow({ force: true });
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
  void syncEngine.restore().then(() => syncNow({ force: true }));
}

/** Removes the triggers and waits for the run in flight, so nothing writes after a wipe. */
export async function stopSync(): Promise<void> {
  stop?.();
  stop = null;
  await syncEngine.settle();
  syncEngine.reset();
}
