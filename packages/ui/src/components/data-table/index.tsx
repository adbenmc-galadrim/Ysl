import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  /**
   * Share of the width, in the mockup's px at 1280: columns keep their
   * proportions as the window narrows or widens instead of fixed widths.
   */
  width: number;
  cell: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Accessible name: "Colis". */
  label: string;
  className?: string;
};

/**
 * A plain table for the desktop: a grey header band and hairlines between
 * 52 px rows. It is a CSS grid with table roles rather than a `<table>`, so
 * the columns can share the width by proportion and rows stay clickable.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  label,
  className,
}: DataTableProps<T>) {
  const template = columns
    .map((column) => `minmax(0, ${column.width}fr)`)
    .join(' ');
  return (
    <div role="table" aria-label={label} className={cn('flex flex-col', className)}>
      <div
        role="row"
        className="grid h-9 items-center rounded-desk bg-sidebar px-4"
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((column) => (
          <span
            key={column.key}
            role="columnheader"
            className="truncate text-12 font-semibold text-muted"
          >
            {column.header}
          </span>
        ))}
      </div>
      <div role="rowgroup" className="mt-[9px]">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            role="row"
            onClick={onRowClick && (() => onRowClick(row))}
            className={cn(
              'grid h-[51px] items-center px-4',
              // The hairline sits on top of every row but the first, so the
              // last row ends on white rather than on a line.
              'not-first:h-[52px] not-first:border-t not-first:border-separator',
              onRowClick && 'cursor-pointer hover:bg-fill',
            )}
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((column) => (
              // The right padding keeps a truncated value off the next
              // column when the window narrows; column starts do not move.
              <span key={column.key} role="cell" className="flex min-w-0 pr-2">
                {column.cell(row)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
