import type { ComponentProps, ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type ChoiceCardProps = Omit<ComponentProps<'button'>, 'children'> & {
  icon: IconName;
  label: ReactNode;
  selected?: boolean;
};

/**
 * A square-ish choice led by a big icon: how something will be proven
 * ("Signature de Paul", "Photo du badge"). The icon carries the meaning, so
 * it is drawn at 24 px above the label rather than beside it. Selected, the
 * card takes the surface colour and an ink edge, like `ChoiceTile`; it sits in the same
 * `ChoiceTileGrid`.
 */
export function ChoiceCard({
  icon,
  label,
  selected = false,
  className,
  type = 'button',
  ...props
}: ChoiceCardProps) {
  return (
    <button
      type={type}
      role="radio"
      aria-checked={selected}
      className={cn(
        'flex h-24 min-w-0 cursor-pointer flex-col items-start rounded-card px-[18px] pt-[18px] text-left',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
        'transition-[filter] active:brightness-95',
        selected ? 'bg-surface ring-2 ring-ink ring-inset' : 'bg-fill',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={24} className="shrink-0" />
      <span className="mt-[18px] w-full truncate text-15 font-semibold">
        {label}
      </span>
    </button>
  );
}
