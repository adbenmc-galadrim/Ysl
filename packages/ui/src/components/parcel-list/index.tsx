import { useVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  type ParcelSectionProps,
  SectionParcelRow,
} from '#components/parcel-section';
import { SectionHeader } from '#components/section-header';
import { SkeletonSection } from '#components/skeleton';

export type ParcelListSection = Omit<ParcelSectionProps, 'className'>;

export type ParcelListProps = {
  sections: ParcelListSection[];
  /** The scrolling column of the screen (`Screen`'s `scrollRef`). */
  scroller: HTMLDivElement | null;
  /** A placeholder section is drawn after the last one. */
  loading?: boolean;
  /** Gap above the title of the section at this index. */
  gapAbove?: (index: number) => number;
  /**
   * Titles of the folded sections: only their title and count are drawn.
   * With `onToggleSection`, a tap on a title folds or unfolds it.
   */
  folded?: readonly string[];
  onToggleSection?: (title: string) => void;
};

type ListItem =
  | {
      kind: 'header';
      key: string;
      section: ParcelListSection;
      top: number;
      open: boolean;
    }
  | {
      kind: 'row';
      key: string;
      section: ParcelListSection;
      parcel: ParcelListSection['parcels'][number];
      separator: boolean;
    }
  | { kind: 'skeleton'; key: string; top: number };

const defaultGap = (index: number) => (index ? 29 : 33);

/** Headers and rows in one flat run, the shape a virtual list scrolls. */
function toItems(
  sections: ParcelListSection[],
  loading: boolean,
  gapAbove: (index: number) => number,
  folded: readonly string[] = [],
): ListItem[] {
  const items: ListItem[] = sections.flatMap((section, s): ListItem[] => {
    const id = section.id ?? section.title;
    const open = !folded.includes(section.title);
    const header: ListItem = {
      kind: 'header',
      key: `h:${id}`,
      section,
      top: gapAbove(s),
      open,
    };
    if (!open) return [header];
    return [
      header,
      ...section.parcels.map((parcel, i): ListItem => ({
        kind: 'row',
        key: `r:${id}:${parcel.id}`,
        section,
        parcel,
        separator: i < section.parcels.length - 1,
      })),
    ];
  });
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
 * Sections of parcels drawn as a virtual list: a busy desk keeps hundreds of
 * parcels, and only the rows in view (and a screen of margin) are in the
 * page. Rows grow with a note, so each one is measured once drawn. The home
 * list and the search results share it, so a parcel reads the same in both.
 */
export function ParcelList({
  sections,
  scroller,
  loading = false,
  gapAbove = defaultGap,
  folded,
  onToggleSection,
}: ParcelListProps) {
  const items = useMemo(
    () => toItems(sections, loading, gapAbove, folded),
    [sections, loading, gapAbove, folded],
  );
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  // The list starts under whatever the screen draws above it (title,
  // banner, filters), which comes and goes and whose height moves with the
  // text: the virtual rows are placed from wherever it lands. Anything
  // above that changes also resizes the column holding the list.
  useLayoutEffect(() => {
    const list = listRef.current;
    const column = list?.parentElement;
    if (!list || !column || !scroller) return;
    const place = () => setOffset(list.offsetTop);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(column);
    return () => observer.disconnect();
  }, [scroller]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller,
    estimateSize: (i) => {
      const item = items[i]!;
      if (item.kind === 'header') {
        return (
          item.top + 24 + (item.open && item.section.parcels.length ? 24 : 0)
        );
      }
      if (item.kind === 'skeleton') return item.top + 24 + 24 + 3 * ROW_PX;
      return ROW_PX;
    },
    getItemKey: (i) => items[i]!.key,
    scrollMargin: offset,
    overscan: 8,
    // Before the scroller is measured, a phone's height of rows is drawn,
    // so the first frame is not an empty list.
    initialRect: { width: 0, height: 844 },
    // React 19 warns on `flushSync` inside a render; a frame late on a
    // fast fling is invisible, a console full of warnings is not.
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
            <ListItemView item={item} onToggleSection={onToggleSection} />
          </div>
        );
      })}
    </div>
  );
}

function ListItemView({
  item,
  onToggleSection,
}: {
  item: ListItem;
  onToggleSection?: (title: string) => void;
}) {
  switch (item.kind) {
    case 'header': {
      const { section } = item;
      return (
        <div
          style={{
            paddingTop: item.top,
            paddingBottom: item.open && section.parcels.length ? 24 : 0,
          }}
        >
          <SectionHeader
            title={section.title}
            count={section.count ?? section.parcels.length}
            action={section.action}
            expanded={item.open}
            onToggle={onToggleSection && (() => onToggleSection(section.title))}
          />
        </div>
      );
    }
    case 'row':
      return (
        <SectionParcelRow
          section={item.section}
          parcel={item.parcel}
          separator={item.separator}
        />
      );
    case 'skeleton':
      return (
        <div style={{ paddingTop: item.top }}>
          <SkeletonSection />
        </div>
      );
  }
}
