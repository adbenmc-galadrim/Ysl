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
};

export type SyncEngineOptions = {
  db: CourrierDatabase;
  push: PushClient;
  pull: PullClient;
  online?: () => boolean;
  now?: () => Date;
  /** Called when the server answered 401: the session is gone. */
  onUnauthorized?: () => void;
};

export type SyncRun = {
  status: Exclude<SyncRunStatus, 'syncing'>;
  applied: number;
  rejected: number;
  pulled: number;
};

export const INITIAL_SYNC_SNAPSHOT: SyncSnapshot = {
  status: 'idle',
  lastSyncAt: null,
  lastError: null,
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
}: SyncEngineOptions) {
  let snapshot = INITIAL_SYNC_SNAPSHOT;
  const listeners = new Set<() => void>();
  let inFlight: Promise<SyncRun> | null = null;

  function set(patch: Partial<SyncSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  async function run(): Promise<SyncRun> {
    if (!online()) {
      set({ status: 'offline' });
      return { status: 'offline', applied: 0, rejected: 0, pulled: 0 };
    }
    set({ status: 'syncing' });
    try {
      const pushed = await pushOutbox(db, push);
      if (pushed.stopped === 'failed') throw pushed.error;
      const pulled = await pullChanges(db, pull);
      const at = now();
      await db.syncState.put({ key: SYNC_STATE_KEYS.lastSyncAt, value: at });
      set({
        status: pushed.stopped === 'retry' ? 'error' : 'idle',
        lastSyncAt: at,
        lastError: pushed.stopped === 'retry' ? 'retry' : null,
      });
      return {
        status: pushed.stopped === 'retry' ? 'error' : 'idle',
        applied: pushed.applied,
        rejected: pushed.rejected,
        pulled: pulled.rows,
      };
    } catch (error) {
      if (isUnauthorized(error)) onUnauthorized?.();
      set({
        status: online() ? 'error' : 'offline',
        lastError: describeError(error),
      });
      return {
        status: online() ? 'error' : 'offline',
        applied: 0,
        rejected: 0,
        pulled: 0,
      };
    }
  }

  return {
    syncNow(): Promise<SyncRun> {
      if (!inFlight) {
        inFlight = run().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    /** Marks the device offline without a request, e.g. on the `offline` event. */
    markOffline() {
      if (!inFlight) set({ status: 'offline' });
    },
    reset() {
      snapshot = INITIAL_SYNC_SNAPSHOT;
      for (const listener of listeners) listener();
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
