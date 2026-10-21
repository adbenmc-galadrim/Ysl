import type { ComponentProps, ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type LinkCardProps = Omit<ComponentProps<'button'>, 'children'> & {
  icon: IconName;
  label: ReactNode;
};

/**
 * A grey card that opens a side path of the flow: "Retiré par quelqu’un
 * d’autre". It reads as an option, not an action — regular weight and a
 * chevron, next to the screen's black button.
 */
export function LinkCard({
  icon,
  label,
  className,
  type = 'button',
  ...props
}: LinkCardProps) {
  return (
    <button
      type={type}
      className={cn(
        'flex h-14 w-full cursor-pointer items-center gap-3 rounded-control bg-fill pr-[3px] pl-3.5 text-left text-15',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue active:brightness-95',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={20} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Icon
        name="chevron"
        size={18}
        strokeWidth={2.2}
        className="shrink-0 text-faint"
      />
    </button>
  );
}
