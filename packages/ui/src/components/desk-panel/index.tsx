import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type DeskStat = {
  label: string;
  value: string;
  tone?: 'orange' | 'red';
};

/** The bordered strip of key figures at the top of a desktop page. */
export function DeskStats({
  stats,
  className,
}: {
  stats: DeskStat[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'flex h-[76px] shrink-0 rounded-desk border border-separator py-[11px]',
        className,
      )}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            'min-w-0 flex-1 pl-[15px]',
            i > 0 && 'border-l border-separator pl-4',
          )}
        >
          <dt className="text-12 font-medium text-muted">{stat.label}</dt>
          <dd
            className={cn(
              'mt-1.5 text-22 font-bold',
              stat.tone === 'orange' && 'text-orange',
              stat.tone === 'red' && 'text-red',
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A bordered block of a desktop page: its title, a hairline, its content.
 * `overlayStroke` lays the stroke over the box instead of insetting the
 * content by it, as the settings pages are drawn.
 */
export function DeskPanel({
  title,
  subtitle,
  action,
  overlayStroke = false,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  overlayStroke?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'relative shrink-0 rounded-desk',
        overlayStroke
          ? 'bg-surface after:pointer-events-none after:absolute after:inset-0 after:rounded-desk after:border after:border-separator'
          : 'flex flex-col border border-separator',
        className,
      )}
    >
      <header
        className={cn(
          'flex shrink-0 items-start justify-between border-b border-separator',
          overlayStroke ? 'px-4 pt-3.5' : 'px-[15px] pt-3',
          overlayStroke
            ? subtitle
              ? 'h-[59px]'
              : 'h-[45px]'
            : subtitle
              ? 'h-[58px]'
              : 'h-11',
        )}
      >
        <div className="min-w-0">
          <h2 className={cn('text-14 font-semibold', overlayStroke && 'relative -top-px')}>
            {title}
          </h2>
          {subtitle && (
            <p className={cn('text-12 text-muted', overlayStroke ? 'mt-[3px]' : 'mt-1')}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <span className="text-13 font-medium">{action}</span>}
      </header>
      {children}
    </section>
  );
}

/** The bare panel opened beside a table: a stroke, the page's content inside. */
export function DeskSidePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'relative shrink-0 rounded-desk border border-separator bg-surface',
        className,
      )}
    >
      {children}
    </aside>
  );
}
