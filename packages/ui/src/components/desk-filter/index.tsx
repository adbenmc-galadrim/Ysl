import type { ComponentProps } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type DeskFilterButtonProps = Omit<ComponentProps<'button'>, 'onSelect'> & {
  /** Grey part: "Statut". */
  label: string;
  /** Ink part: "Tous". */
  value: string;
  icon?: IconName;
  /** With these it opens the system's list, laid invisibly over the drawing. */
  choices?: readonly { value: string; label: string }[];
  selected?: string;
  onSelect?: (value: string) => void;
};

/**
 * A filter of a desktop table: « Statut : Tous », a 30 px outlined box. The
 * mockups fix its width, so a screen sets it with `className`.
 */
export function DeskFilterButton({
  label,
  value,
  icon,
  choices,
  selected,
  onSelect,
  className,
  type = 'button',
  ...props
}: DeskFilterButtonProps) {
  const face = (
    <button
      type={type}
      tabIndex={choices ? -1 : undefined}
      className={cn(
        'flex h-[30px] shrink-0 cursor-pointer items-center gap-[3px] rounded-[6px] border border-border bg-surface pl-[9px] text-left text-13 whitespace-nowrap outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue',
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={14} className="mr-[3px] text-muted" />}
      <span className="text-muted">{label} :</span>
      <span className="-mt-0.5 font-medium">{value}</span>
    </button>
  );
  if (!choices) return face;
  return (
    <span className="relative inline-flex shrink-0 rounded-[6px] focus-within:ring-2 focus-within:ring-blue">
      {face}
      <select
        aria-label={label}
        value={selected}
        onChange={(event) => onSelect?.(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </span>
  );
}
