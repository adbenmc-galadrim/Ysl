import { SYNC_STATE_KEYS, type CourrierDatabase } from '#/features/db/schema';
import { describeError } from '#/features/sync/errors';
import { pullChanges, type PullClient } from '#/features/sync/pull';
import { pushOutbox, type PushClient } from '#/features/sync/push';

export type SyncRunStatus = 'idle' | 'syncing' | 'offline' | 'error';

export type SyncSnapshot = {
  status: SyncRunStatus;
  /** When a push and a pull last both went through, on this device. */
  lastSyncAt: Date | null;
  lastError: string | null;
  /** Rows written by the pull of the run in flight, or of the last one. */
  pulled: number;
  /**
   * A run has ended since the app was opened, whatever its outcome: until
   * then, rows from the server may still be on their way.
   */
  settled: boolean;
};

export type SyncEngineOptions = {
  db: CourrierDatabase;
  push: PushClient;
  pull: PullClient;
  online?: () => boolean;
  now?: () => Date;
  /** Called when the server answered 401: the session is gone. */
  onUnauthorized?: () => void;
  /** Settles what the pull resolved of the refused changes (a handover lost to another iPhone). */
  afterPull?: () => Promise<void>;
};

export type SyncNowOptions = {
  /** A tap or the network coming back: runs even during a back-off. */
  force?: boolean;
};

/** Back-off after a failed run: 2 s, 4 s, … up to 5 min, for the automatic triggers. */
export const BACKOFF_FIRST_MS = 2_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

export function backoffAfter(failures: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_FIRST_MS * 2 ** (failures - 1));
}

export type SyncRun = {
  status: Exclude<SyncRunStatus, 'syncing'> | 'skipped';
  applied: number;
  rejected: number;
  pulled: number;
};

export const INITIAL_SYNC_SNAPSHOT: SyncSnapshot = {
  status: 'idle',
  lastSyncAt: null,
  lastError: null,
  pulled: 0,
  settled: false,
};

function isUnauthorized(error: unknown): boolean {
  const data = (error as { data?: { code?: string } } | null)?.data;
  return data?.code === 'UNAUTHORIZED';
}

/**
 * One synchronisation at a time: push what the device changed, then pull
 * what the server has. A run asked for while one is going joins it. Offline,
 * nothing is tried: the `online` event will call again.
 */
export function createSyncEngine({
  db,
  push,
  pull,
  online = () => navigator.onLine,
  now = () => new Date(),
  onUnauthorized,
  afterPull,
}: SyncEngineOptions) {
  let snapshot = INITIAL_SYNC_SNAPSHOT;
  const listeners = new Set<() => void>();
  let inFlight: Promise<SyncRun> | null = null;
  let failures = 0;
  let retryAt = 0;

  const nothing = (status: SyncRun['status']): SyncRun => ({
    status,
    applied: 0,
    rejected: 0,
    pulled: 0,
  });

  function failed(error: unknown) {
    failures += 1;
    retryAt = now().getTime() + backoffAfter(failures);
    const status = online() ? 'error' : 'offline';
    set({ status, lastError: describeError(error), settled: true });
    return nothing(status);
  }

  function set(patch: Partial<SyncSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  async function run(): Promise<SyncRun> {
    if (!online()) {
      set({ status: 'offline', settled: true });
      return nothing('offline');
    }
    set({ status: 'syncing', pulled: 0 });
    try {
      const pushed = await pushOutbox(db, push);
      if (pushed.stopped === 'failed') throw pushed.error;
      const pulled = await pullChanges(db, pull, {
        onProgress: (rows) => set({ pulled: rows }),
      });
      await afterPull?.();
      const at = now();
      await db.syncState.put({ key: SYNC_STATE_KEYS.lastSyncAt, value: at });
      if (pushed.stopped === 'retry') {
        failures += 1;
        retryAt = at.getTime() + backoffAfter(failures);
      } else {
        failures = 0;
      }
      const status = pushed.stopped === 'retry' ? 'error' : 'idle';
      set({
        status,
        lastSyncAt: at,
        lastError: pushed.stopped === 'retry' ? 'retry' : null,
        settled: true,
      });
      return {
        status,
        applied: pushed.applied,
        rejected: pushed.rejected,
        pulled: pulled.rows,
      };
    } catch (error) {
      if (isUnauthorized(error)) onUnauthorized?.();
      return failed(error);
    }
  }

  return {
    syncNow({ force = false }: SyncNowOptions = {}): Promise<SyncRun> {
      if (inFlight) return inFlight;
      if (!force && now().getTime() < retryAt) {
        return Promise.resolve(nothing('skipped'));
      }
      inFlight = run().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    /** Reads what the last session left: when it last synchronised. */
    async restore(): Promise<void> {
      const entry = await db.syncState.get(SYNC_STATE_KEYS.lastSyncAt);
      const at = entry?.value;
      if (at instanceof Date && snapshot.lastSyncAt === null) {
        set({ lastSyncAt: at });
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    /** Resolves once no run is in flight: nothing will write after it. */
    async settle(): Promise<void> {
      while (inFlight) await inFlight.catch(() => undefined);
    },
    /** Marks the device offline without a request, e.g. on the `offline` event. */
    markOffline() {
      if (!inFlight) set({ status: 'offline' });
    },
    reset() {
      snapshot = INITIAL_SYNC_SNAPSHOT;
      failures = 0;
      retryAt = 0;
      for (const listener of listeners) listener();
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
