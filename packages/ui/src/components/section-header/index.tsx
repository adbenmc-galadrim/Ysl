import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type SectionHeaderProps = {
  title: ReactNode;
  /** Shown after the title in grey: how many items the section holds. */
  count?: number;
  /** A small button aligned right, e.g. "Notifier". */
  action?: ReactNode;
  /**
   * Makes the title and its count a button that folds the section; `expanded`
   * says whether its rows are shown.
   */
  onToggle?: () => void;
  expanded?: boolean;
  /** `lg` is the 22 px title of the multi-company phone screens. */
  size?: 'md' | 'lg';
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
  onToggle,
  expanded = true,
  size = 'md',
  className,
}: SectionHeaderProps) {
  const label = (
    <>
      {title}
      {count !== undefined && (
        <span className="font-medium text-muted">{size === 'lg' ? ` ${count}` : `  ${count}`}</span>
      )}
    </>
  );
  return (
    <div className={cn('flex h-6 items-center justify-between', className)}>
      <h2
        className={cn(
          'font-bold whitespace-pre text-ink',
          size === 'lg' ? 'text-22' : 'text-20',
        )}
      >
        {onToggle ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className="-my-2.5 cursor-pointer py-2.5 text-left outline-none focus-visible:underline"
          >
            {label}
          </button>
        ) : (
          label
        )}
      </h2>
      {action}
    </div>
  );
}
