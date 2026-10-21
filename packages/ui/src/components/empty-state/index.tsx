import type { ReactNode } from 'react';

import { HeroTile } from '#components/hero-tile';
import type { IconName } from '#icons';
import { cn } from '#lib/tv';

export type EmptyStateProps = {
  icon: IconName;
  title: ReactNode;
  description?: ReactNode;
  /** The way out: a primary button, then an optional link under it. */
  children?: ReactNode;
  className?: string;
};

/**
 * An empty list. It says why the list is empty and offers the next step, so
 * a blank screen at 8 a.m. reads as "nothing to do yet", not as a fault.
 */
export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <HeroTile icon={icon} size="lg" />
      <h2 className="mt-6 text-22 font-bold">{title}</h2>
      {description && (
        <p className="mt-2 max-w-[300px] text-16 leading-[23px] text-muted">
          {description}
        </p>
      )}
      {children && (
        <div className="mt-[26px] flex flex-col items-center gap-5">
          {children}
        </div>
      )}
    </div>
  );
}
