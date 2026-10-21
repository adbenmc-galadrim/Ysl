import type { ComponentProps, ReactNode } from 'react';

import { cn } from '#lib/tv';

export type ChipProps = ComponentProps<'button'> & {
  selected?: boolean;
};

/**
 * A filter or a single choice among short labels: black when on, white with
 * a hairline when off. Black rather than blue so it matches the one primary
 * button of the screen.
 */
export function Chip({
  selected = false,
  className,
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-chip px-4 text-15 whitespace-nowrap',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
        selected
          ? 'bg-black font-semibold text-white'
          : 'bg-white font-medium text-ink ring-1 ring-border ring-inset',
        className,
      )}
      {...props}
    />
  );
}

export type ChipGroupProps = {
  children: ReactNode;
  /** Accessible name of the group, e.g. "Filtres" or "Motif". */
  label: string;
  /**
   * `scroll` keeps one line that runs off the edge (search filters);
   * `wrap` breaks onto as many lines as needed (a reason to pick).
   */
  layout?: 'scroll' | 'wrap';
  className?: string;
};

export function ChipGroup({
  children,
  label,
  layout = 'wrap',
  className,
}: ChipGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex gap-2',
        layout === 'wrap'
          ? 'flex-wrap gap-y-2.5'
          : // Bleeds into the gutters so the last chip is cut by the screen
            // edge, which is what says "there is more, swipe".
            '-mx-5 overflow-x-auto px-5 [scrollbar-width:none]',
        className,
      )}
    >
      {children}
    </div>
  );
}
