import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type LargeTitleProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * 34 on a home screen, 28 on a pushed screen; `record` (32) names the
   * person or parcel a record screen is about.
   */
  size?: 'lg' | 'md' | 'record';
  className?: string;
};

/** The iOS large title, with the one-line summary that sits under it. */
export function LargeTitle({
  title,
  subtitle,
  size = 'lg',
  className,
}: LargeTitleProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-0.5',
        size === 'record' && 'gap-1',
        className,
      )}
    >
      <h1
        className={cn(
          'font-bold text-ink',
          size === 'lg' && 'text-34',
          size === 'md' && 'text-28',
          size === 'record' && 'text-32',
        )}
      >
        {title}
      </h1>
      {subtitle && <p className="text-15 text-muted">{subtitle}</p>}
    </header>
  );
}
