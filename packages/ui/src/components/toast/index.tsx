import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type ToastProps = {
  message: ReactNode;
  /** Label of the one action a toast may carry, e.g. "Mettre à jour". */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * A dark bar over the bottom bar, for news that needs no decision now: a new
 * version, an undo. It is a live region so VoiceOver reads it as it lands.
 */
export function Toast({ message, actionLabel, onAction, className }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex h-[52px] items-center justify-between gap-3 rounded-card bg-night px-[18px] text-15 text-white',
        className,
      )}
    >
      <span className="min-w-0 truncate font-medium">{message}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 cursor-pointer font-semibold text-night-blue outline-none focus-visible:ring-2 focus-visible:ring-night-blue"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
