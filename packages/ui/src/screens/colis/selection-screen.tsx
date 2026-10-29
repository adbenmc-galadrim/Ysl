import { type ReactNode, useState } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { LargeTitle } from '#components/large-title';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { ParcelList, type ParcelListSection } from '#components/parcel-list';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import type { Parcel } from '#fixtures/parcels';
import { type ColisCounter, ColisCounters } from '#screens/colis/colis-screen';

export type SelectionScreenProps = {
  /** The sections as the list shows them; the screen ticks their rows. */
  sections: ParcelListSection[];
  /** Ids of the ticked parcels, those out of view included. */
  selectedIds: readonly string[];
  onSelectedChange?: (parcel: Parcel, selected: boolean) => void;
  /** « Tout sélectionner », or « Tout désélectionner » once all in view are ticked. */
  allSelected?: boolean;
  onSelectAll?: () => void;
  /** « OK »: back to the plain list. */
  onDone?: () => void;
  /** The counters of the list, still filters while selecting. */
  counters?: ColisCounter[];
  /** A field narrowing the rows in view, under the title. */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** The grey button: « Relancer », or « Notifier » when a notice is due. */
  remindLabel?: string;
  onRemind?: () => void;
  onHandover?: () => void;
  /** A « ⋯ » beside « OK »: the actions the bar has no room for. */
  onMore?: () => void;
  /** A toast over the bar, e.g. what an action left out. */
  toast?: ReactNode;
  /** Replaces the list, e.g. when the filter keeps nothing. */
  children?: ReactNode;
};

/**
 * Selection mode of the home list: several parcels handed over or chased in
 * one go — a colleague collecting for the whole team. The rows are the
 * home list's, ticked by id, so the selection holds while the list scrolls
 * or a filter hides some of it.
 */
export function SelectionScreen({
  sections,
  selectedIds,
  onSelectedChange,
  allSelected = false,
  onSelectAll,
  onDone,
  counters,
  query,
  onQueryChange,
  remindLabel = 'Relancer',
  onRemind,
  onHandover,
  onMore,
  toast,
  children,
}: SelectionScreenProps) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const count = selectedIds.length;
  const title = `${count} colis sélectionné${count > 1 ? 's' : ''}`;
  const ticked = sections.map((section) => ({
    ...section,
    selectedIds,
    onSelectedChange,
  }));
  return (
    <Screen
      scrollRef={setScroller}
      bottom={
        <div className="flex flex-col">
          {toast && <div className="px-5">{toast}</div>}
          <BottomBar surface="line" className="pt-[15px]">
            <Button
              variant="secondary"
              icon="bell"
              iconSize={20}
              disabled={count === 0}
              onClick={onRemind}
              className="w-[134px] justify-start gap-2 pr-0 pl-5 text-16"
            >
              {remindLabel}
            </Button>
            <Button
              disabled={count === 0}
              onClick={onHandover}
              className="min-w-0 flex-1"
            >
              {`Remettre ${count} colis`}
            </Button>
          </BottomBar>
        </div>
      }
    >
      <NavBar
        back={false}
        leading={
          <NavBarAction
            tone="blue"
            className="font-normal"
            onClick={onSelectAll}
          >
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </NavBarAction>
        }
        trailing={
          <span className="flex items-center gap-2">
            {onMore && (
              <IconButton
                icon="more"
                label="Plus d’actions"
                variant="ghost"
                size="lg"
                disabled={count === 0}
                onClick={onMore}
                className="text-blue disabled:opacity-40"
              />
            )}
            <NavBarAction tone="blue" onClick={onDone}>
              OK
            </NavBarAction>
          </span>
        }
      />
      {/* The count is read out as it changes, the agent's only feedback
          when ticking rows by ear. */}
      <div aria-live="polite" className="mt-1">
        <LargeTitle size="md" title={title} />
      </div>
      {onQueryChange && (
        <SearchField
          value={query ?? ''}
          onChange={(event) => onQueryChange(event.target.value)}
          onClear={() => onQueryChange('')}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="mt-4"
        />
      )}
      {counters && counters.length > 0 && (
        <ColisCounters counters={counters} className="mt-[15px]" />
      )}
      {children ?? (
        <ParcelList sections={ticked} scroller={scroller} gapAbove={gapAbove} />
      )}
    </Screen>
  );
}

const gapAbove = (index: number) => (index ? 29 : 24);
