import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type DeskTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** In px, as measured on the mockup. Left out, the column takes what remains. */
  width?: number;
  /** What a column without `width` keeps when a narrower table has nothing left. */
  minWidth?: number;
  cell: (row: T) => ReactNode;
};

export type DeskTableProps<T> = {
  columns: DeskTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Accessible name: "Colis". */
  label: string;
  /** Pitch of the rows, hairline included: 40, 44 or 48 in the mockups. */
  rowHeight?: number;
  /** Draws the column of boxes. */
  selectable?: boolean;
  /** Keys of the ticked rows. */
  selected?: readonly string[];
  /** Key of the row whose record is open beside the table. */
  activeRow?: string;
  onRowClick?: (row: T) => void;
  /** Under the rows: `DeskTablePagination`, usually. */
  footer?: ReactNode;
  /**
   * The columns give way under their measured px instead of being cut at the
   * edge, when a record opened beside the table leaves it less than the mockup.
   */
  shrink?: boolean;
  className?: string;
};

function DeskTableBox({ checked = false }: { checked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border',
        checked
          ? 'border-ink bg-ink text-on-ink'
          : 'border-border bg-surface',
      )}
    >
      {checked && <Icon name="tick" size={10} />}
    </span>
  );
}

/**
 * The bordered table of the multi-company desktop: a 32 px grey head, rows in
 * 13 px on a measured pitch, an optional column of boxes and a footer. Its
 * columns have the mockup's px: a record often opens beside it, and the table
 * then keeps its grid.
 */
export function DeskTable<T>({
  columns,
  rows,
  rowKey,
  label,
  rowHeight = 40,
  selectable = false,
  selected,
  activeRow,
  onRowClick,
  footer,
  shrink = false,
  className,
}: DeskTableProps<T>) {
  const template = [
    ...(selectable ? ['28px'] : []),
    ...columns.map((column) => {
      if (column.width === undefined) {
        return `minmax(${column.minWidth ?? 0}px, 1fr)`;
      }
      return shrink ? `minmax(0, ${column.width}px)` : `${column.width}px`;
    }),
  ].join(' ');
  return (
    <div
      role="table"
      aria-label={label}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-desk bg-surface',
        // Penpot strokes inside: an overlay, which does not push the rows in.
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-desk after:border after:border-separator',
        className,
      )}
    >
      <div
        role="row"
        className="grid h-[33px] shrink-0 items-center border-b border-separator bg-sidebar px-4"
        style={{ gridTemplateColumns: template }}
      >
        {selectable && <DeskTableBox />}
        {columns.map((column) => (
          <span
            key={column.key}
            role="columnheader"
            className="truncate text-12 font-medium text-muted"
          >
            {column.header}
          </span>
        ))}
      </div>
      {rows.map((row, i) => {
        const key = rowKey(row);
        return (
          <div
            key={key}
            role="row"
            onClick={onRowClick && (() => onRowClick(row))}
            className={cn(
              'grid shrink-0 items-center border-separator px-4 text-13',
              (footer || i < rows.length - 1) && 'border-b',
              key === activeRow && 'bg-fill',
              onRowClick && 'cursor-pointer hover:bg-fill',
            )}
            style={{ gridTemplateColumns: template, height: rowHeight }}
          >
            {selectable && <DeskTableBox checked={selected?.includes(key)} />}
            {columns.map((column) => (
              <span
                key={column.key}
                role="cell"
                className="flex min-w-0 items-center pb-[2.5px] whitespace-nowrap"
              >
                {column.cell(row)}
              </span>
            ))}
          </div>
        );
      })}
      {footer}
    </div>
  );
}

export type DeskTablePaginationProps = {
  /** "1–5 sur 12". */
  range: string;
  onPrevious?: () => void;
  onNext?: () => void;
};

/** The foot of a table: the range on the left, the two page buttons on the right. */
export function DeskTablePagination({
  range,
  onPrevious,
  onNext,
}: DeskTablePaginationProps) {
  return (
    <div className="flex h-11 shrink-0 items-start justify-between pt-[7px] pr-4 pl-4">
      <span className="mt-1.5 text-13 text-muted">{range}</span>
      <span className="flex gap-2">
        <Button
          variant="outline"
          size="desk"
          onClick={onPrevious}
          className="w-[88px]"
        >
          Précédent
        </Button>
        <Button
          variant="outline"
          size="desk"
          onClick={onNext}
          className="w-[84px]"
        >
          Suivant
        </Button>
      </span>
    </div>
  );
}
