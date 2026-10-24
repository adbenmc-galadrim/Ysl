import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import { db } from '#/features/db/database';
import type { SyncRunStatus } from '#/features/sync/engine';
import {
  countOutbox,
  EMPTY_OUTBOX,
  type OutboxCounts,
} from '#/features/sync/outbox-counts';
import { syncEngine } from '#/features/sync/sync';
import { useOnline } from '#/lib/use-online';

export type SyncView = OutboxCounts & {
  online: boolean;
  status: SyncRunStatus;
  lastSyncAt: Date | null;
};

/** What the screens show of the synchronisation: live, from the engine and the outbox. */
export function useSync(): SyncView {
  const online = useOnline();
  const snapshot = useSyncExternalStore(
    syncEngine.subscribe,
    syncEngine.getSnapshot,
    syncEngine.getSnapshot,
  );
  const counts = useLiveQuery(() => countOutbox(db), [], EMPTY_OUTBOX);
  return {
    online,
    status: snapshot.status,
    pending: counts.pending,
    rejected: counts.rejected,
    oldestAt: counts.oldestAt,
    lastSyncAt: snapshot.lastSyncAt,
  };
}
