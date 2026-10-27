import type { ReactNode } from 'react';

import { iconTileVariants, type IconTileProps } from '#components/icon-tile';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type ActionCardProps = Pick<IconTileProps, 'icon' | 'tone'> & {
  title: ReactNode;
  subtitle?: ReactNode;
  /** The blue action under the hairline: "Synchroniser maintenant". */
  action?: ReactNode;
  onAction?: () => void;
  /** Greyed out while it cannot run: offline, or already running. */
  actionDisabled?: boolean;
  /**
   * `lg` is a state the screen is about (44 px tile, 18 px title); `md` a
   * notice among other cards (40 px tile, 16 px title).
   */
  size?: 'md' | 'lg';
  className?: string;
};

/**
 * A surface card that states something and offers one way to act on it — the
 * sync state, the next data purge. The action spans the card so it is as
 * easy to hit as a full row.
 */
export function ActionCard({
  icon,
  tone,
  title,
  subtitle,
  action,
  onAction,
  actionDisabled = false,
  size = 'md',
  className,
}: ActionCardProps) {
  const lg = size === 'lg';
  return (
    <div className={cn('rounded-control bg-surface text-ink', className)}>
      <div
        className={cn(
          'flex items-start',
          lg ? 'gap-3.5 px-[18px] pt-[18px] pb-2.5' : 'gap-3 px-4 pt-4 pb-[18px]',
        )}
      >
        <span className={iconTileVariants({ tone, class: lg && 'size-11' })}>
          <Icon name={icon} size={lg ? 22 : 18} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span
            className={cn('font-semibold', lg ? 'text-18' : 'text-16')}
          >
            {title}
          </span>
          {subtitle && (
            <span className={cn('text-14 text-muted', lg ? 'mt-0.5' : 'mt-[3px]')}>
              {subtitle}
            </span>
          )}
        </span>
      </div>
      {action && (
        <div className="mx-4 border-t border-separator">
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className={cn(
              'w-full cursor-pointer text-center text-16 font-semibold text-blue outline-none',
              'focus-visible:ring-2 focus-visible:ring-blue active:opacity-60',
              'disabled:cursor-default disabled:opacity-40',
              lg ? 'pt-[13px] pb-[15px]' : 'py-[17px]',
            )}
          >
            {action}
          </button>
        </div>
      )}
    </div>
  );
}
