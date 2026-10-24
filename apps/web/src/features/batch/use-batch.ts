import { useLiveQuery } from 'dexie-react-hooks';
import { countDrafts, currentBatch, lastDraft } from '#/features/batch/store';
import { db } from '#/features/db/database';
import type { DraftBatch, DraftParcel } from '#/features/db/schema';

export type BatchView = {
  batch: DraftBatch | undefined;
  count: number;
  last: DraftParcel | undefined;
};

/** The batch in progress as the screen shows it; `undefined` on first paint. */
export function useBatch(): BatchView | undefined {
  return useLiveQuery(async () => {
    const batch = await currentBatch(db);
    if (!batch) return { batch, count: 0, last: undefined };
    const [count, last] = await Promise.all([
      countDrafts(db, batch.id),
      lastDraft(db, batch.id),
    ]);
    return { batch, count, last };
  }, []);
}
