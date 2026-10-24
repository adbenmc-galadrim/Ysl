import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import { db } from '#/features/db/database';
import { syncEngine } from '#/features/sync/sync';
import { useOnline } from '#/lib/use-online';

export type SyncView = {
  online: boolean;
  status: 'idle' | 'syncing' | 'offline' | 'error';
  /** Changes made on this device that the server has not taken yet. */
  pending: number;
  /** Changes the server refused for good, waiting for a correction. */
  rejected: number;
  lastSyncAt: Date | null;
};

async function countOutbox() {
  const [pending, rejected] = await Promise.all([
    db.outbox.where('state').equals('queued').count(),
    db.outbox.where('state').equals('rejected').count(),
  ]);
  return { pending, rejected };
}

/** What the screens show of the synchronisation: live, from the engine and the outbox. */
export function useSync(): SyncView {
  const online = useOnline();
  const snapshot = useSyncExternalStore(
    syncEngine.subscribe,
    syncEngine.getSnapshot,
    syncEngine.getSnapshot,
  );
  const counts = useLiveQuery(countOutbox, [], { pending: 0, rejected: 0 });
  return {
    online,
    status: snapshot.status,
    pending: counts.pending,
    rejected: counts.rejected,
    lastSyncAt: snapshot.lastSyncAt,
  };
}
