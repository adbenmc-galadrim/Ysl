import type { ReactNode } from 'react';

import { ParcelRow } from '#components/parcel-row';
import { SectionHeader } from '#components/section-header';
import type { Parcel } from '#fixtures/parcels';

export type ParcelSectionProps = {
  title: string;
  /** Tells apart sections whose titles may repeat (two people of one name). */
  id?: string;
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
  /**
   * A button on the right of a row that opens something else than the
   * row (« Choisir » the recipient); returning nothing keeps `rowAction`.
   */
  rowControl?: (parcel: Parcel) => ReactNode;
  /** Selection mode: ids of the ticked parcels; rows then show a checkbox. */
  selectedIds?: readonly string[];
  onSelectedChange?: (parcel: Parcel, selected: boolean) => void;
  onParcelClick?: (parcel: Parcel) => void;
  /** A finger resting on a row: the home list enters selection mode. */
  onParcelLongPress?: (parcel: Parcel) => void;
  className?: string;
};

export type SectionParcelRowProps = {
  section: Omit<ParcelSectionProps, 'className'>;
  parcel: Parcel;
  separator: boolean;
};

/**
 * One row of a section, as the section wants it drawn. Shared with the home
 * screen's virtual list, so a parcel reads the same everywhere.
 */
export function SectionParcelRow({
  section,
  parcel,
  separator,
}: SectionParcelRowProps) {
  const {
    rowAction,
    rowControl,
    selectedIds,
    onSelectedChange,
    onParcelClick,
    onParcelLongPress,
  } = section;
  const control = rowControl?.(parcel);
  return (
    <ParcelRow
      parcel={parcel}
      // In selection mode a tap ticks the row instead of opening it,
      // so the chevron would promise a screen that never comes.
      trailing={rowAction?.(parcel) ?? (selectedIds ? null : 'chevron')}
      control={control || undefined}
      selected={selectedIds?.includes(parcel.id)}
      onSelectedChange={(selected) => onSelectedChange?.(parcel, selected)}
      separator={separator}
      onClick={onParcelClick && (() => onParcelClick(parcel))}
      onLongPress={onParcelLongPress && (() => onParcelLongPress(parcel))}
    />
  );
}

/**
 * One group of the parcel list: its title with the count, then the rows.
 * The search results and the selection mode are stacks of these; the home
 * screen draws the same headers and rows in a virtual list.
 */
export function ParcelSection({ className, ...props }: ParcelSectionProps) {
  const { title, parcels, count, action } = props;
  return (
    <section className={className}>
      <SectionHeader
        title={title}
        count={count ?? parcels.length}
        action={action}
      />
      <div className="mt-6">
        {parcels.map((parcel, i) => (
          <SectionParcelRow
            key={parcel.id}
            section={props}
            parcel={parcel}
            separator={i < parcels.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
