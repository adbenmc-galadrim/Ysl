import type { ComponentProps, ReactNode } from 'react';

import { CheckCircle } from '#components/checkbox';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { cn } from '#lib/tv';

export type OptionCardProps = Omit<ComponentProps<'button'>, 'title'> &
  Pick<IconTileProps, 'icon' | 'tone'> & {
    title: ReactNode;
    description?: ReactNode;
    selected?: boolean;
  };

/**
 * One answer of a "how?" question, with a line saying what it leads to.
 * Like `ChoiceTile`, the chosen card turns white with a black edge; it is
 * taller because each option needs its consequence spelt out.
 */
export function OptionCard({
  icon,
  tone = 'neutral',
  title,
  description,
  selected = false,
  className,
  type = 'button',
  ...props
}: OptionCardProps) {
  return (
    <button
      type={type}
      role="radio"
      aria-checked={selected}
      className={cn(
        'flex h-[72px] w-full cursor-pointer items-center gap-3 rounded-card px-3 text-left',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
        selected ? 'bg-white ring-2 ring-black ring-inset' : 'bg-fill',
        className,
      )}
      {...props}
    >
      <IconTile icon={icon} tone={tone} />
      {/* 3 px under the text: Penpot sets the pair 15 px from the top of
          the 72 px card, a hair above centre. */}
      <span className="flex min-w-0 flex-1 flex-col pb-[3px]">
        <span className="truncate text-16 font-semibold text-ink">{title}</span>
        {description && (
          <span className="mt-1 truncate text-13 text-muted">
            {description}
          </span>
        )}
      </span>
      <CheckCircle checked={selected} />
    </button>
  );
}

export function OptionCardGroup({
  children,
  label,
  className,
}: {
  children: ReactNode;
  /** Accessible name of the radio group: the question it answers. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex flex-col gap-3', className)}
    >
      {children}
    </div>
  );
}
