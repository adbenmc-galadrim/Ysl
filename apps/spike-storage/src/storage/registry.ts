import type { KeyValueStore } from '#/journal';

export type Registry = { count: number; lastSeq: number };

const KEY = 'spike-storage:committed';

export function readRegistry(store: KeyValueStore): Registry | undefined {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<Registry> | null;
    if (
      typeof parsed?.count === 'number' &&
      typeof parsed.lastSeq === 'number'
    ) {
      return { count: parsed.count, lastSeq: parsed.lastSeq };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function recordCommit(store: KeyValueStore, seq: number): void {
  const current = readRegistry(store) ?? { count: 0, lastSeq: 0 };
  try {
    store.setItem(
      KEY,
      JSON.stringify({
        count: current.count + 1,
        lastSeq: Math.max(current.lastSeq, seq),
      } satisfies Registry),
    );
  } catch {
    return;
  }
}

export function resetRegistry(store: KeyValueStore): void {
  try {
    store.setItem(KEY, JSON.stringify({ count: 0, lastSeq: 0 }));
  } catch {
    return;
  }
}
