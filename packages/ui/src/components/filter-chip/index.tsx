import type { ComponentProps, ReactNode } from 'react';

import { cn } from '#lib/tv';

export type FilterChipProps = Omit<ComponentProps<'button'>, 'children'> & {
  label: ReactNode;
  /** How many items the filter keeps, after the label in the same ink. */
  count?: number;
  selected?: boolean;
};

/**
 * A 36 px filter over a list. The selected one is filled with ink so the active
 * view reads from across the desk; the others stay on the surface with a hairline.
 * Width follows the label, so "Aujourd’hui" and "En file 2" sit side by side
 * on the smallest iPhone.
 */
export function FilterChip({
  label,
  count,
  selected = false,
  className,
  type = 'button',
  ...props
}: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-chip px-5 text-15 whitespace-pre',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
        selected
          ? 'bg-ink font-semibold text-on-ink'
          : 'border border-border bg-surface font-medium text-ink',
        className,
      )}
      {...props}
    >
      {label}
      {count !== undefined && `  ${count}`}
    </button>
  );
}

/** A row of chips that scrolls sideways rather than wrapping. */
export function FilterChips({
  children,
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      role="toolbar"
      className={cn('flex gap-2 overflow-x-auto', className)}
      {...props}
    >
      {children}
    </div>
  );
}
