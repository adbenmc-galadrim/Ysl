import type { ReactNode } from 'react';

import { ProgressBar, type ProgressBarProps } from '#components/progress-bar';
import { cn } from '#lib/tv';

export type ProgressRowProps = {
  /** The 40 px tile; it lines up with the title, not with the bar. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  subtitleTone?: 'muted' | 'orange' | 'red';
  /** Right of the title: a check, a percentage, a warning icon. */
  trailing?: ReactNode;
  value: number;
  tone?: ProgressBarProps['tone'];
  className?: string;
};

/**
 * One download, or any task that fills up: what it is, how far, and a bar
 * under the text column so the three bars of a list line up.
 */
export function ProgressRow({
  leading,
  title,
  subtitle,
  subtitleTone = 'muted',
  trailing,
  value,
  tone,
  className,
}: ProgressRowProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {leading && <span className="flex shrink-0">{leading}</span>}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="truncate text-17 font-semibold">{title}</span>
            {subtitle && (
              <span
                className={cn(
                  'truncate text-14',
                  subtitleTone === 'muted' && 'text-muted',
                  subtitleTone === 'orange' && 'text-orange',
                  subtitleTone === 'red' && 'text-red',
                )}
              >
                {subtitle}
              </span>
            )}
          </div>
          {trailing && <span className="flex shrink-0">{trailing}</span>}
        </div>
        <ProgressBar
          value={value}
          tone={tone}
          label={typeof title === 'string' ? title : undefined}
          className="mt-3"
        />
      </div>
    </div>
  );
}
