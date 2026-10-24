import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { LargeTitle } from '#components/large-title';
import {
  ParcelSection,
  type ParcelSectionProps,
} from '#components/parcel-section';
import { Screen } from '#components/screen';
import { SearchTrigger } from '#components/search-field';
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
  /** A toast floating over the bottom bar. */
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
      bottom={
        bar && toast ? (
          // The bar comes second so its white fade runs over the toast's
          // bottom edge, as in the mockups.
          <div className="flex flex-col">
            <div className="px-5">{toast}</div>
            {bar}
          </div>
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
        <>
          {sections.map((section, s) => (
            <ParcelSection
              key={section.title}
              {...section}
              className={s ? 'mt-[29px]' : notice ? 'mt-[26px]' : 'mt-[33px]'}
            />
          ))}
          {loading && (
            <SkeletonSection
              className={sections.length ? 'mt-[29px]' : 'mt-[33px]'}
            />
          )}
        </>
      )}
    </Screen>
  );
}
