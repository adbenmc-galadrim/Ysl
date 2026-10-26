import type { ComponentProps, ReactNode } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type ChipProps = ComponentProps<'button'> & {
  selected?: boolean;
};

/**
 * A filter or a single choice among short labels: ink-filled when on, surface with
 * a hairline when off. Ink rather than blue so it matches the one primary
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
          ? 'bg-ink font-semibold text-on-ink'
          : 'bg-surface font-medium text-ink ring-1 ring-border ring-inset',
        className,
      )}
      {...props}
    />
  );
}

export type ChipSelectOption = { value: string; label: string };

export type ChipSelectProps = {
  /** Accessible name of the choice, e.g. "Grouper". */
  label: string;
  value: string;
  options: readonly ChipSelectOption[];
  onChange?: (value: string) => void;
  className?: string;
};

/**
 * A chip that shows the current choice and opens the system menu on tap:
 * a setting of the list (how it is grouped) rather than a filter, so it is
 * never filled.
 */
export function ChipSelect({
  label,
  value,
  options,
  onChange,
  className,
}: ChipSelectProps) {
  const current = options.find((option) => option.value === value);
  return (
    <span
      className={cn(
        'relative inline-flex h-9 shrink-0 items-center gap-1 rounded-chip bg-surface pr-3 pl-4 text-15 font-medium whitespace-nowrap text-ink ring-1 ring-border ring-inset',
        'focus-within:ring-2 focus-within:ring-blue',
        className,
      )}
    >
      {current?.label}
      <Icon name="chevron" size={16} strokeWidth={2.2} className="rotate-90" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
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
