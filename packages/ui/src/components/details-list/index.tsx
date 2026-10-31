import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type DetailsItem = { label: ReactNode; value: ReactNode };

export type DetailsListProps = {
  items: DetailsItem[];
  className?: string;
} & (
  | {
      /** Bold heading over the rows, e.g. "Détails". */
      title?: ReactNode;
      variant?: 'phone';
      labelWidth?: never;
    }
  | {
      /**
       * The 13 px record of the desktop panels: the value in a column
       * `labelWidth` px from the label, on a 30 px pitch and without hairlines.
       */
      variant: 'desk';
      title?: never;
      labelWidth?: number;
    }
);

/**
 * Key / value rows of a record, label grey on the left, value on the right.
 * Read-only: editing goes through the pencil of the screen, so the rows are
 * not dressed as buttons.
 */
export function DetailsList({
  title,
  items,
  variant = 'phone',
  labelWidth = 120,
  className,
}: DetailsListProps) {
  if (variant === 'desk')
    return (
      <dl className={cn('flex flex-col gap-3.5 text-13', className)}>
        {items.map((item, i) => (
          <div key={i} className="flex">
            <dt className="shrink-0 text-muted" style={{ width: labelWidth }}>
              {item.label}
            </dt>
            <dd className="min-w-0 truncate font-medium text-ink">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    );
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
