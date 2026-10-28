import type { RecipientKind } from '@repo/contract/recipient';

/** One handover still to make from a selection: who, and which of their parcels. */
export type QueuedHandover = {
  kind: RecipientKind;
  id: string;
  name: string;
  parcelIds: string[];
};

type QueueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY = 'courrier.remise.file';

const storage = (): QueueStorage | undefined =>
  typeof sessionStorage === 'undefined' ? undefined : sessionStorage;

const isQueued = (value: unknown): value is QueuedHandover => {
  const row = value as Partial<QueuedHandover> | null;
  return (
    typeof row === 'object' &&
    row !== null &&
    (row.kind === 'person' || row.kind === 'contact') &&
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    Array.isArray(row.parcelIds) &&
    row.parcelIds.every((id) => typeof id === 'string')
  );
};

/**
 * The handovers a selection left to make, person by person (F31), kept for
 * the tab's life only: an app relaunched starts from Colis, not halfway
 * through someone else's queue.
 */
export function readQueue(store = storage()): QueuedHandover[] {
  try {
    const value: unknown = JSON.parse(store?.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter(isQueued) : [];
  } catch {
    return [];
  }
}

export function writeQueue(
  queue: readonly QueuedHandover[],
  store = storage(),
): void {
  if (queue.length) store?.setItem(KEY, JSON.stringify(queue));
  else store?.removeItem(KEY);
}

/** The next handover, taken off the queue. */
export function shiftQueue(store = storage()): QueuedHandover | undefined {
  const [next, ...rest] = readQueue(store);
  writeQueue(rest, store);
  return next;
}
