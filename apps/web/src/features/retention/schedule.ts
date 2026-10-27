import type { CourrierDatabase } from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';
import {
  purgeLocal,
  type LocalPurgeReport,
} from '#/features/retention/local-purge';

/** After a synchronisation (every minute while open), the purge runs at most this often. */
export const AFTER_SYNC_EVERY_MS = 15 * 60_000;

type Idle = (work: () => void) => void;

/** When the main thread has nothing better to do; Safari has no `requestIdleCallback`. */
const whenIdle: Idle = (work) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(work, { timeout: 5_000 });
  } else {
    setTimeout(work, 1_000);
  }
};

export type LocalPurgeScheduler = {
  /** At launch: always. After a synchronisation: once in a while. */
  schedule(options?: { force?: boolean }): Promise<LocalPurgeReport | null>;
};

/**
 * Runs the local purge off the critical path: queued for an idle moment,
 * never two at once, and a failure only logged — the purge must never stop
 * the app.
 */
export function createLocalPurgeScheduler({
  db,
  files,
  idle = whenIdle,
  now = () => new Date(),
}: {
  db: CourrierDatabase;
  files: () => PhotoFiles | null;
  idle?: Idle;
  now?: () => Date;
}): LocalPurgeScheduler {
  let running: Promise<LocalPurgeReport | null> | null = null;
  let lastRun = Number.NEGATIVE_INFINITY;

  return {
    schedule({ force = false } = {}) {
      if (running) return running;
      if (!force && now().getTime() - lastRun < AFTER_SYNC_EVERY_MS) {
        return Promise.resolve(null);
      }
      lastRun = now().getTime();
      running = new Promise<LocalPurgeReport | null>((resolve) => {
        idle(() => {
          purgeLocal(db, files(), now())
            .then(resolve, (error: unknown) => {
              console.warn('Local purge failed', error);
              resolve(null);
            })
            .finally(() => {
              running = null;
            });
        });
      });
      return running;
    },
  };
}
