import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type StatCardProps = {
  /** The figure, already formatted: "612", "1,4 j". */
  value: ReactNode;
  label: ReactNode;
  /** `orange` flags a figure that calls for action (parcels waiting). */
  tone?: 'ink' | 'orange' | 'red';
  className?: string;
};

/**
 * One figure of a report on a grey tile. The figure is large and the label
 * small and under it: the agent scans the numbers, not the words.
 */
export function StatCard({ value, label, tone = 'ink', className }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex h-[84px] min-w-0 flex-col rounded-card bg-fill px-4 pt-3',
        className,
      )}
    >
      <span
        className={cn(
          'text-28 font-bold',
          tone === 'orange' && 'text-orange',
          tone === 'red' && 'text-red',
        )}
      >
        {value}
      </span>
      <span className="mt-1.5 truncate text-13 text-muted">{label}</span>
    </div>
  );
}
