import { type ReactNode, useState } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { FilterChip, FilterChips } from '#components/filter-chip';
import { IconButton } from '#components/icon-button';
import { LargeTitle } from '#components/large-title';
import { NavBarAction } from '#components/nav-bar';
import { ParcelList, type ParcelListSection } from '#components/parcel-list';
import { Screen } from '#components/screen';
import { SearchTrigger } from '#components/search-field';
import { SYNC_PILL, StatusPill } from '#components/status-pill';
import { cn } from '#lib/tv';

export type ColisSection = ParcelListSection;

/** A counter over the list (F32): « À compléter 1 », a tap keeps only those. */
export type ColisCounter = {
  label: string;
  count: number;
  selected?: boolean;
  onClick?: () => void;
};

export type ColisScreenProps = {
  sync: keyof typeof SYNC_PILL;
  summary: string;
  sections: ColisSection[];
  /** Under the title, what the day leaves to do, each one a filter. */
  counters?: ColisCounter[];
  /** A banner between the title and the list, e.g. changes left to send. */
  notice?: ReactNode;
  /** The sections still on their way are drawn as a placeholder section. */
  loading?: boolean;
  /** A toast floating over the bottom bar, or in its place when the bar is hidden. */
  toast?: ReactNode;
  /**
   * The search and scan bar. The empty state hides it: its own "Scanner des
   * colis" is the one action left, and two scan buttons would compete.
   */
  bottomBar?: boolean;
  /**
   * Contents of the bottom bar, in place of search and scan: the bar with
   * the "Remettre" shortcut, for a desk that hands over more than it scans.
   */
  actions?: ReactNode;
  /**
   * Titles of the folded sections: only their title and count are drawn.
   * With `onToggleSection`, a tap on a title folds or unfolds it.
   */
  folded?: readonly string[];
  onToggleSection?: (title: string) => void;
  /** Replaces the sections, e.g. with an empty state. */
  children?: ReactNode;
  onMenu?: () => void;
  /** Shows « Sélectionner » beside the menu: the list turns into checkboxes. */
  onSelect?: () => void;
  onSearch?: () => void;
  onScan?: () => void;
};

/**
 * Home. The list is the to-do list of the mailroom: what to complete, what to
 * notify, what is waiting, what went out today — in that order, because that
 * is the order the day is worked in.
 */
export function ColisScreen({
  sync,
  summary,
  sections,
  counters,
  notice,
  loading = false,
  toast,
  bottomBar = true,
  actions,
  folded,
  onToggleSection,
  children,
  onMenu,
  onSelect,
  onSearch,
  onScan,
}: ColisScreenProps) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const bar = bottomBar && (
    <BottomBar className={toast ? '-mt-2' : undefined}>
      {actions ?? (
        <>
          <SearchTrigger onClick={onSearch} />
          <Button icon="scan" onClick={onScan} className="w-[145px]">
            Scanner
          </Button>
        </>
      )}
    </BottomBar>
  );
  return (
    <Screen
      scrollRef={setScroller}
      bottom={
        bar && toast ? (
          // The bar comes second so its surface fade runs over the toast's
          // bottom edge, as in the mockups.
          <div className="flex flex-col">
            <div className="px-5">{toast}</div>
            {bar}
          </div>
        ) : toast ? (
          // Without the bar (empty state), the toast keeps the bar's place so
          // news of a new version still reaches a desk with nothing to do.
          <div className="px-5 pb-[calc(var(--safe-bottom)+6px)]">{toast}</div>
        ) : (
          bar || undefined
        )
      }
    >
      <div className="flex h-10 items-center justify-between">
        <StatusPill {...SYNC_PILL[sync]} />
        <div className="flex items-center gap-1">
          {onSelect && (
            <NavBarAction
              tone="blue"
              className="font-normal"
              onClick={onSelect}
            >
              Sélectionner
            </NavBarAction>
          )}
          <IconButton icon="menu" label="Menu" onClick={onMenu} />
        </div>
      </div>
      <LargeTitle title="Colis" subtitle={summary} className="mt-0.5" />
      {counters && counters.length > 0 && (
        <ColisCounters counters={counters} className="mt-[15px]" />
      )}
      {notice && <div className="mt-[15px]">{notice}</div>}
      {children ?? (
        <ParcelList
          sections={sections}
          loading={loading}
          gapAbove={notice ? gapUnderNotice : undefined}
          folded={folded}
          onToggleSection={onToggleSection}
          scroller={scroller}
        />
      )}
    </Screen>
  );
}

/** The counters as a row of chips, scrolling sideways when they overflow. */
export function ColisCounters({
  counters,
  className,
}: {
  counters: ColisCounter[];
  className?: string;
}) {
  return (
    <FilterChips
      aria-label="Compteurs"
      className={cn('-mx-5 px-5 [scrollbar-width:none]', className)}
    >
      {counters.map((counter) => (
        <FilterChip
          key={counter.label}
          label={counter.label}
          count={counter.count}
          selected={counter.selected}
          onClick={counter.onClick}
          // Three counters fit the smallest iPhone side by side.
          className="px-3.5 text-14"
        />
      ))}
    </FilterChips>
  );
}

/** Under a banner the first title sits tighter, as in the mockups. */
function gapUnderNotice(index: number) {
  return index ? 29 : 26;
}
