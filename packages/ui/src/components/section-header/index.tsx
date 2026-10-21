import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type SectionHeaderProps = {
  title: ReactNode;
  /** Shown after the title in grey: how many items the section holds. */
  count?: number;
  /** A small button aligned right, e.g. "Notifier". */
  action?: ReactNode;
  className?: string;
};

/**
 * A list section title. The sections of the home screen are the work queue —
 * "À compléter", "À notifier", "En attente de retrait" — so the count is part
 * of the title rather than a badge.
 */
export function SectionHeader({
  title,
  count,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex h-6 items-center justify-between', className)}>
      <h2 className="text-20 font-bold whitespace-pre text-ink">
        {title}
        {count !== undefined && (
          <span className="font-medium text-muted">{`  ${count}`}</span>
        )}
      </h2>
      {action}
    </div>
  );
}
