import { useCallback, useState } from 'react';
import {
  SEARCH_FILTERS,
  SEARCH_GROUPINGS,
  type SearchFilter,
  type SearchGrouping,
} from '#/features/search/search-index';

/** What was typed and the chip, for the time the app stays open. */
export const SEARCH_KEY = 'courrier.recherche';
/** How results are grouped, a habit of the desk kept across launches. */
export const GROUPING_KEY = 'courrier.recherche.groupe';

export type SearchState = { query: string; filter: SearchFilter };

export const EMPTY_SEARCH: SearchState = { query: '', filter: 'all' };

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function read(storage: KeyStorage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function write(storage: KeyStorage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function readSearch(storage: KeyStorage = sessionStorage): SearchState {
  const value = read(storage, SEARCH_KEY);
  if (typeof value !== 'object' || value === null) return EMPTY_SEARCH;
  const { query, filter } = value as Record<string, unknown>;
  return {
    query: typeof query === 'string' ? query : '',
    filter: SEARCH_FILTERS.find((id) => id === filter) ?? 'all',
  };
}

export function writeSearch(
  state: SearchState,
  storage: KeyStorage = sessionStorage,
) {
  write(storage, SEARCH_KEY, state);
}

export function clearSearch(storage: KeyStorage = sessionStorage) {
  try {
    storage.removeItem(SEARCH_KEY);
  } catch {
    return;
  }
}

export function readGrouping(
  storage: KeyStorage = localStorage,
): SearchGrouping {
  const value = read(storage, GROUPING_KEY);
  return SEARCH_GROUPINGS.find((id) => id === value) ?? 'status';
}

export function writeGrouping(
  grouping: SearchGrouping,
  storage: KeyStorage = localStorage,
) {
  write(storage, GROUPING_KEY, grouping);
}

/**
 * The query and the chip survive a change of chip or grouping, and a trip
 * to another screen and back; "Annuler" forgets them.
 */
export function useSearchState() {
  const [search, setSearch] = useState(() => readSearch());
  const [grouping, setGrouping] = useState(() => readGrouping());
  const update = useCallback((patch: Partial<SearchState>) => {
    setSearch((current) => {
      const next = { ...current, ...patch };
      writeSearch(next);
      return next;
    });
  }, []);
  const group = useCallback((next: SearchGrouping) => {
    setGrouping(next);
    writeGrouping(next);
  }, []);
  const reset = useCallback(() => {
    clearSearch();
    setSearch(EMPTY_SEARCH);
  }, []);
  return { search, grouping, update, group, reset };
}
