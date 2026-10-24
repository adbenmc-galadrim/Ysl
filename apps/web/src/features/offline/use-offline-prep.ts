import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import { db } from '#/features/db/database';
import { SYNC_STATE_KEYS } from '#/features/db/schema';
import { derivePacks, type PrepView } from '#/features/offline/packs';
import { getPrepSnapshot, subscribePrep } from '#/features/offline/prep';
import { syncEngine } from '#/features/sync/sync';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

async function readDirectory() {
  const [cursor, persons] = await Promise.all([
    db.syncState.get(SYNC_STATE_KEYS.cursor),
    db.directoryPerson.count(),
  ]);
  return { hasCursor: cursor !== undefined, persons };
}

const NO_DIRECTORY = { hasCursor: false, persons: 0 };

/** The preparation screen's rows, live: sync engine, local tables, models cache, service worker. */
export function useOfflinePrep(): PrepView {
  const online = useOnline();
  const sync = useSyncExternalStore(
    syncEngine.subscribe,
    syncEngine.getSnapshot,
    syncEngine.getSnapshot,
  );
  const prep = useSyncExternalStore(
    subscribePrep,
    getPrepSnapshot,
    getPrepSnapshot,
  );
  const directory = useLiveQuery(readDirectory, [sync.pulled], NO_DIRECTORY);
  return derivePacks(
    {
      directory: { online, status: sync.status, ...directory },
      models: prep.models,
      shell: prep.shell,
    },
    t,
  );
}
