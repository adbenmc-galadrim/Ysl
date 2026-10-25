import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { LargeTitle } from '#components/large-title';
import { ParcelRow } from '#components/parcel-row';
import type { ParcelSectionProps } from '#components/parcel-section';
import { Screen } from '#components/screen';
import { SearchTrigger } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import { SkeletonSection } from '#components/skeleton';
import { SYNC_PILL, StatusPill } from '#components/status-pill';

export type ColisSection = Omit<ParcelSectionProps, 'className'>;

export type ColisScreenProps = {
  sync: keyof typeof SYNC_PILL;
  summary: string;
  sections: ColisSection[];
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
  /** Replaces the sections, e.g. with an empty state. */
  children?: ReactNode;
  onMenu?: () => void;
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
  notice,
  loading = false,
  toast,
  bottomBar = true,
  actions,
  children,
  onMenu,
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
          // The bar comes second so its white fade runs over the toast's
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
        <IconButton icon="menu" label="Menu" onClick={onMenu} />
      </div>
      <LargeTitle title="Colis" subtitle={summary} className="mt-0.5" />
      {notice && <div className="mt-[15px]">{notice}</div>}
      {children ?? (
        <ColisList
          sections={sections}
          loading={loading}
          notice={Boolean(notice)}
          scroller={scroller}
        />
      )}
    </Screen>
  );
}

type ListItem =
  | { kind: 'header'; key: string; section: ColisSection; top: number }
  | {
      kind: 'row';
      key: string;
      section: ColisSection;
      parcel: ColisSection['parcels'][number];
      separator: boolean;
    }
  | { kind: 'skeleton'; key: string; top: number };

/** Gap above a section title: tighter under a banner, as in the mockups. */
function sectionTop(index: number, notice: boolean) {
  if (index) return 29;
  return notice ? 26 : 33;
}

/** Headers and rows in one flat run, the shape a virtual list scrolls. */
function toItems(
  sections: ColisSection[],
  loading: boolean,
  notice: boolean,
): ListItem[] {
  const items: ListItem[] = sections.flatMap((section, s): ListItem[] => [
    {
      kind: 'header',
      key: `h:${section.title}`,
      section,
      top: sectionTop(s, notice),
    },
    ...section.parcels.map((parcel, i): ListItem => ({
      kind: 'row',
      key: `r:${parcel.id}`,
      section,
      parcel,
      separator: i < section.parcels.length - 1,
    })),
  ]);
  if (loading) {
    items.push({
      kind: 'skeleton',
      key: 'skeleton',
      top: sections.length ? 29 : 33,
    });
  }
  return items;
}

/** A row with its separator: the 78 px pitch of `ListRow`. */
const ROW_PX = 78;

/**
 * The sections, drawn as a virtual list: a busy desk keeps hundreds of
 * parcels waiting, and only the rows in view (and a screen of margin) are in
 * the page. Rows grow with a note, so each one is measured once drawn.
 */
function ColisList({
  sections,
  loading,
  notice,
  scroller,
}: {
  sections: ColisSection[];
  loading: boolean;
  notice: boolean;
  scroller: HTMLDivElement | null;
}) {
  const items = useMemo(
    () => toItems(sections, loading, notice),
    [sections, loading, notice],
  );
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  // The list starts under the title and the banner, whose height moves with
  // the text: the virtual rows are placed from wherever it lands.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !scroller) return;
    const place = () => setOffset(list.offsetTop);
    place();
    const observer = new ResizeObserver(place);
    for (const child of list.parentElement?.children ?? []) {
      if (child !== list) observer.observe(child);
    }
    return () => observer.disconnect();
  }, [scroller]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller,
    estimateSize: (i) => {
      const item = items[i]!;
      if (item.kind === 'header') {
        return item.top + 24 + (item.section.parcels.length ? 24 : 0);
      }
      if (item.kind === 'skeleton') return item.top + 24 + 24 + 3 * ROW_PX;
      return ROW_PX;
    },
    getItemKey: (i) => items[i]!.key,
    scrollMargin: offset,
    overscan: 8,
    initialRect: { width: 0, height: 844 },
    useFlushSync: false,
  });

  return (
    <div
      ref={listRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtual) => {
        const item = items[virtual.index]!;
        return (
          <div
            key={virtual.key}
            data-index={virtual.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${virtual.start - offset}px)` }}
          >
            <ListItemView item={item} />
          </div>
        );
      })}
    </div>
  );
}

function ListItemView({ item }: { item: ListItem }) {
  switch (item.kind) {
    case 'header': {
      const { section } = item;
      return (
        <div
          style={{
            paddingTop: item.top,
            paddingBottom: section.parcels.length ? 24 : 0,
          }}
        >
          <SectionHeader
            title={section.title}
            count={section.count ?? section.parcels.length}
            action={section.action}
          />
        </div>
      );
    }
    case 'row': {
      const { section, parcel } = item;
      return (
        <ParcelRow
          parcel={parcel}
          trailing={
            section.rowAction?.(parcel) ??
            (section.selectedIds ? null : 'chevron')
          }
          selected={section.selectedIds?.includes(parcel.id)}
          onSelectedChange={(selected) =>
            section.onSelectedChange?.(parcel, selected)
          }
          separator={item.separator}
          onClick={
            section.onParcelClick && (() => section.onParcelClick?.(parcel))
          }
        />
      );
    }
    case 'skeleton':
      return (
        <div style={{ paddingTop: item.top }}>
          <SkeletonSection />
        </div>
      );
  }
}
