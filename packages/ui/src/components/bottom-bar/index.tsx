import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

export type BottomBarProps = {
  children: ReactNode;
  /**
   * `fade` lets the list scroll behind a white gradient (home screen);
   * `line` draws a hairline over a white bar (forms, detail screens);
   * `plain` is a white bar without the hairline, when nothing scrolls under it;
   * `none` leaves the bar transparent (camera screens);
   * `fade-fill` is `fade` on a grey page (a preview made of white cards).
   */
  surface?: 'fade' | 'fade-fill' | 'line' | 'plain' | 'none';
  className?: string;
};

/**
 * The thumb zone. Every screen keeps its actions here, at the same height,
 * so the hand never has to look for them — the brief's "one hand, a parcel in
 * the other".
 */
export function BottomBar({
  children,
  surface = 'fade',
  className,
}: BottomBarProps) {
  return (
    <div
      className={cn(
        'flex gap-3 px-5 pb-[calc(var(--safe-bottom)+6px)]',
        surface === 'fade' && 'bottom-fade pt-9',
        surface === 'fade-fill' && 'bottom-fade-fill pt-9',
        surface === 'line' && 'border-t border-separator bg-white pt-4',
        surface === 'plain' && 'bg-white pt-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
