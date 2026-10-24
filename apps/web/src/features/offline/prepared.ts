export const PREPARED_KEY = 'courrier.prepared';

export type PreparedStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Whether this device went through the preparation screen (or skipped it). */
export const isPrepared = (store: PreparedStore): boolean =>
  store.getItem(PREPARED_KEY) === '1';

export function markPrepared(store: PreparedStore): void {
  store.setItem(PREPARED_KEY, '1');
}

/** At sign-out: the local data goes, the next session prepares again. */
export function forgetPrepared(store: PreparedStore): void {
  store.removeItem(PREPARED_KEY);
}
