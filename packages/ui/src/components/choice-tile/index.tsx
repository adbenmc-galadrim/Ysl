import type { ComponentProps, ReactNode } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type ChoiceTileProps = Omit<ComponentProps<'button'>, 'children'> & {
  label: ReactNode;
  selected?: boolean;
};

/**
 * A large single-choice tile: a storage location, a reason. Bigger than a
 * chip because it is picked with a thumb while holding a parcel; the chosen
 * one turns white with a black outline and a check, so the choice still reads
 * on a phone held at arm's length.
 */
export function ChoiceTile({
  label,
  selected = false,
  className,
  type = 'button',
  ...props
}: ChoiceTileProps) {
  return (
    <button
      type={type}
      role="radio"
      aria-checked={selected}
      className={cn(
        // `pb-px`: Penpot sets the label 22 px down the 64 px tile, half a
        // pixel above true centre.
        'flex h-16 min-w-0 cursor-pointer items-center gap-2 rounded-card pr-2.5 pb-px pl-4 text-left text-16',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue',
        'transition-[filter] active:brightness-95',
        selected
          ? 'bg-white font-semibold ring-2 ring-black ring-inset'
          : 'bg-fill font-medium',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected && (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black text-white">
          <Icon name="tick" size={14} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

export type ChoiceTileGridProps = {
  children: ReactNode;
  /** Accessible name of the radio group, e.g. the question it answers. */
  label: string;
  className?: string;
};

/** Two equal columns: wide enough for "Sol, grand format" at 375 px. */
export function ChoiceTileGrid({
  children,
  label,
  className,
}: ChoiceTileGridProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid grid-cols-2 gap-x-[9px] gap-y-3', className)}
    >
      {children}
    </div>
  );
}
