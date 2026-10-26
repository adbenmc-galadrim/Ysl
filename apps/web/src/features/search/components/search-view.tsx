import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, EmptyState, RechercheScreen } from '@repo/ui';
import { useDeferredValue, useMemo } from 'react';
import {
  groupResults,
  SEARCH_FILTERS,
  SEARCH_GROUPINGS,
  type SearchEntry,
  type SearchGrouping,
  searchEntries,
} from '#/features/search/search-index';
import { useSearchState } from '#/features/search/search-state';

const t = createTranslator(DEFAULT_LOCALE);

const GROUPING_OPTIONS = SEARCH_GROUPINGS.map((value) => ({
  value,
  label: t(`search.group.${value}`),
}));

const isGrouping = (value: string): value is SearchGrouping =>
  SEARCH_GROUPINGS.some((grouping) => grouping === value);

export type SearchViewProps = {
  /** The local parcels, ready to search; `undefined` while they are read. */
  entries: readonly SearchEntry[] | undefined;
  now: Date;
  onCancel: () => void;
  /** A tap on a result opens its record. */
  onOpen?: (parcelId: string) => void;
};

/**
 * The search screen over the parcels on the iPhone. A keystroke filters
 * entries normalized beforehand and the list draws only what is in view;
 * the field never waits for the list, which follows a frame later when
 * the iPhone is busy.
 */
export function SearchView({
  entries,
  now,
  onCancel,
  onOpen,
}: SearchViewProps) {
  const { search, grouping, update, group, reset } = useSearchState();
  const query = useDeferredValue(search.query);
  const results = useMemo(
    () => (entries ? searchEntries(entries, query, search.filter, now) : []),
    [entries, query, search.filter, now],
  );
  const sections = useMemo(
    () =>
      groupResults(results, grouping, now, t).map((section) => ({
        ...section,
        onParcelClick:
          onOpen && ((parcel: { id: string }) => onOpen(parcel.id)),
      })),
    [results, grouping, now, onOpen],
  );
  const filters = SEARCH_FILTERS.map((id) => ({
    id,
    label: t(`search.filter.${id}`),
    selected: id === search.filter,
  }));
  const empty = entries !== undefined && results.length === 0;
  const typed = query.trim();

  return (
    <RechercheScreen
      query={search.query}
      autoFocus
      filters={filters}
      grouping={{ value: grouping, options: GROUPING_OPTIONS }}
      sections={sections}
      hint={empty || entries === undefined ? undefined : t('search.hint')}
      onQueryChange={(value) => update({ query: value })}
      onFilterChange={(filter) => {
        const id = SEARCH_FILTERS.find((value) => value === filter.id);
        if (id) update({ filter: id });
      }}
      onGroupingChange={(value) => {
        if (isGrouping(value)) group(value);
      }}
      onCancel={() => {
        reset();
        onCancel();
      }}
    >
      {empty ? (
        typed ? (
          <EmptyState
            icon="search"
            title={t('search.empty.title', { query: typed })}
            description={t('search.empty.description')}
            className="mt-[96px]"
          >
            <Button
              variant="link"
              onClick={() => update({ query: '' })}
              className="text-16 font-semibold"
            >
              {t('search.empty.clear')}
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon="inbox"
            title={t('search.none.title')}
            description={
              search.filter === 'all'
                ? t('search.none.empty')
                : t('search.none.description')
            }
            className="mt-[96px]"
          >
            {search.filter !== 'all' && (
              <Button
                variant="link"
                onClick={() => update({ filter: 'all' })}
                className="text-16 font-semibold"
              >
                {t('search.none.all')}
              </Button>
            )}
          </EmptyState>
        )
      ) : undefined}
    </RechercheScreen>
  );
}
