import type { ReactNode } from 'react';

import { ParcelRow } from '#components/parcel-row';
import { SectionHeader } from '#components/section-header';
import type { Parcel } from '#fixtures/parcels';

export type ParcelSectionProps = {
  title: string;
  parcels: Parcel[];
  /** The real total when only the first rows are drawn. */
  count?: number;
  /** Small button next to the title, e.g. "Notifier". */
  action?: ReactNode;
  /**
   * Right side of each row: a small button ("Choisir"), a grey value
   * ("En file"). Returning nothing keeps the chevron.
   */
  rowAction?: (parcel: Parcel) => ReactNode;
  /** Selection mode: ids of the ticked parcels; rows then show a checkbox. */
  selectedIds?: readonly string[];
  onSelectedChange?: (parcel: Parcel, selected: boolean) => void;
  onParcelClick?: (parcel: Parcel) => void;
  className?: string;
};

/**
 * One group of the parcel list: its title with the count, then the rows.
 * The home screen, the search results and the selection mode are all
 * stacks of these, so a parcel reads the same everywhere.
 */
export function ParcelSection({
  title,
  parcels,
  count,
  action,
  rowAction,
  selectedIds,
  onSelectedChange,
  onParcelClick,
  className,
}: ParcelSectionProps) {
  return (
    <section className={className}>
      <SectionHeader
        title={title}
        count={count ?? parcels.length}
        action={action}
      />
      <div className="mt-6">
        {parcels.map((parcel, i) => (
          <ParcelRow
            key={parcel.id}
            parcel={parcel}
            // In selection mode a tap ticks the row instead of opening it,
            // so the chevron would promise a screen that never comes.
            trailing={rowAction?.(parcel) ?? (selectedIds ? null : 'chevron')}
            selected={selectedIds?.includes(parcel.id)}
            onSelectedChange={(selected) => onSelectedChange?.(parcel, selected)}
            separator={i < parcels.length - 1}
            onClick={onParcelClick && (() => onParcelClick(parcel))}
          />
        ))}
      </div>
    </section>
  );
}
