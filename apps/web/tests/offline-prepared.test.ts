import { describe, expect, it } from 'vitest';
import {
  forgetPrepared,
  isPrepared,
  markPrepared,
  PREPARED_KEY,
} from '#/features/offline/prepared';

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
};

describe('prepared flag', () => {
  it('is off until marked, and off again once forgotten', () => {
    const store = memory();
    expect(isPrepared(store)).toBe(false);
    markPrepared(store);
    expect(isPrepared(store)).toBe(true);
    expect(store.getItem(PREPARED_KEY)).toBe('1');
    forgetPrepared(store);
    expect(isPrepared(store)).toBe(false);
  });
});
