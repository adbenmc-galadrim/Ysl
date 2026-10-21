import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type DetailsItem = { label: ReactNode; value: ReactNode };

export type DetailsListProps = {
  /** Bold heading over the rows, e.g. "Détails". */
  title?: ReactNode;
  items: DetailsItem[];
  className?: string;
};

/**
 * Key / value rows of a record, label grey on the left, value on the right.
 * Read-only: editing goes through the pencil of the screen, so the rows are
 * not dressed as buttons.
 */
export function DetailsList({ title, items, className }: DetailsListProps) {
  return (
    <section className={cn('flex flex-col', className)}>
      {title && <h2 className="text-20 font-bold text-ink">{title}</h2>}
      <dl className={cn('flex flex-col', title && 'mt-1')}>
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              'flex items-baseline justify-between gap-4 text-15',
              // The hairline is part of the 34 px pitch, not added to it.
              i ? 'border-t border-separator pt-[7px] pb-2' : 'py-2',
            )}
          >
            <dt className="shrink-0 text-muted">{item.label}</dt>
            <dd className="min-w-0 truncate text-right font-medium text-ink">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
