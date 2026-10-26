import { describe, expect, it } from 'vitest';
import {
  clearSearch,
  EMPTY_SEARCH,
  GROUPING_KEY,
  readGrouping,
  readSearch,
  SEARCH_KEY,
  writeGrouping,
  writeSearch,
} from '#/features/search/search-state';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe('search state', () => {
  it('reads back the query and the chip until Annuler clears them', () => {
    const storage = memoryStorage();
    writeSearch({ query: 'garn', filter: 'delivered' }, storage);
    expect(readSearch(storage)).toEqual({ query: 'garn', filter: 'delivered' });
    clearSearch(storage);
    expect(readSearch(storage)).toEqual(EMPTY_SEARCH);
  });

  it('falls back on a broken or unknown value', () => {
    expect(readSearch(memoryStorage({ [SEARCH_KEY]: '{oops' }))).toEqual(
      EMPTY_SEARCH,
    );
    expect(
      readSearch(
        memoryStorage({ [SEARCH_KEY]: '{"query":"ab","filter":"gone"}' }),
      ),
    ).toEqual({ query: 'ab', filter: 'all' });
    expect(readGrouping(memoryStorage({ [GROUPING_KEY]: '"week"' }))).toBe(
      'status',
    );
  });

  it('keeps the grouping chosen on this iPhone', () => {
    const storage = memoryStorage();
    writeGrouping('date', storage);
    expect(readGrouping(storage)).toBe('date');
  });
});
