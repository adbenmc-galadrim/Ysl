import type { ComponentProps } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type DeskFilterButtonProps = ComponentProps<'button'> & {
  /** Grey part: "Statut". */
  label: string;
  /** Ink part: "Tous". */
  value: string;
  icon?: IconName;
};

/**
 * A filter of a desktop table: « Statut : Tous », a 30 px outlined box. The
 * mockups fix its width, so a screen sets it with `className`.
 */
export function DeskFilterButton({
  label,
  value,
  icon,
  className,
  type = 'button',
  ...props
}: DeskFilterButtonProps) {
  return (
    <button
      type={type}
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
}
