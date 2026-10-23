import { describe, expect, it } from 'vitest';
import { Journal, type KeyValueStore } from '#/journal';

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('Journal sessions', () => {
  it('reports a previous session that was never closed', () => {
    const store = memoryStore();
    const first = new Journal(store, {}, () => 1);
    first.log('app-started');

    const second = new Journal(store, {}, () => 2);

    expect(second.interrupted?.id).toBe('1');
    expect(second.interrupted?.entries).toHaveLength(1);
  });

  it('does not report a session closed on purpose', () => {
    const store = memoryStore();
    new Journal(store, {}, () => 1).close();

    expect(new Journal(store, {}, () => 2).interrupted).toBeUndefined();
  });
});
