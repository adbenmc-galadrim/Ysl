import { type ReactNode, useState } from 'react';

import {
  Chip,
  ChipGroup,
  ChipSelect,
  type ChipSelectOption,
} from '#components/chip';
import { NavBarAction } from '#components/nav-bar';
import { ParcelList, type ParcelListSection } from '#components/parcel-list';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';

export type RechercheFilter = {
  id?: string;
  label: string;
  selected?: boolean;
};

export type RechercheGrouping = {
  value: string;
  options: readonly ChipSelectOption[];
};

export type RechercheScreenProps = {
  query: string;
  filters: RechercheFilter[];
  /** Results, grouped by where the parcel stands, by recipient or by day. */
  sections: ParcelListSection[];
  /** The last chip: how the results are grouped. */
  grouping?: RechercheGrouping;
  /** What the search looks into, under the results. */
  hint?: string;
  /** The field takes the keyboard as soon as the screen opens. */
  autoFocus?: boolean;
  /** Replaces the results, e.g. with "no result". */
  children?: ReactNode;
  onQueryChange?: (query: string) => void;
  onFilterChange?: (filter: RechercheFilter) => void;
  onGroupingChange?: (value: string) => void;
  onCancel?: () => void;
};

const gapAbove = (index: number) => (index ? 29 : 24);

/**
 * Search. It looks through handed-over parcels too, because the question at
 * the desk is as often "did I already give it to her?" as "where is it?".
 * The results are a virtual list: the whole journal can match an empty
 * field.
 */
export function RechercheScreen({
  query,
  filters,
  sections,
  grouping,
  hint,
  autoFocus,
  children,
  onQueryChange,
  onFilterChange,
  onGroupingChange,
  onCancel,
}: RechercheScreenProps) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  return (
    <Screen scrollRef={setScroller}>
      {/* The field and the chips stay pinned under the status bar while
          the results scroll: a long journal never hides what was typed. */}
      <div className="sticky top-0 z-10 -mx-5 -mt-[calc(var(--safe-top)+8px)] bg-surface px-5 pt-[calc(var(--safe-top)+8px)]">
        <div className="-mt-0.5 flex items-center gap-0.5">
          <SearchField
            size="bar"
            value={query}
            autoFocus={autoFocus}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => onQueryChange?.(e.target.value)}
            onClear={() => onQueryChange?.('')}
          />
          {/* As wide as Penpot's text box, so the field keeps its width. */}
          <NavBarAction
            tone="blue"
            onClick={onCancel}
            className="w-[70px] text-right font-medium"
          >
            Annuler
          </NavBarAction>
        </div>
        <ChipGroup label="Filtres" layout="scroll" className="mt-4">
          {filters.map((filter) => (
            <Chip
              key={filter.id ?? filter.label}
              selected={filter.selected}
              onClick={() => onFilterChange?.(filter)}
            >
              {filter.label}
            </Chip>
          ))}
          {grouping && (
            <ChipSelect
              label="Grouper"
              value={grouping.value}
              options={grouping.options}
              onChange={onGroupingChange}
            />
          )}
        </ChipGroup>
      </div>
      {children ?? (
        <ParcelList
          sections={sections}
          scroller={scroller}
          gapAbove={gapAbove}
        />
      )}
      {hint && (
        <p className="mt-[35px] px-4 text-center text-13 leading-[1.4] text-muted">
          {hint}
        </p>
      )}
    </Screen>
  );
}
