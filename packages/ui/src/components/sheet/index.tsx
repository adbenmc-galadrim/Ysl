import { useEffect, useId, type ReactNode } from 'react';

import { cn } from '#lib/tv';

export type SheetProps = {
  title: ReactNode;
  /** Grey text under the title: what the question is about. */
  description?: ReactNode;
  children?: ReactNode;
  /**
   * The screen the sheet was opened from. It stays drawn, dimmed, so the
   * agent keeps their bearings — the camera, the home list.
   */
  behind?: ReactNode;
  /**
   * Lays the sheet over the viewport instead of wrapping `behind`: the app
   * keeps its screen mounted — the live camera, for one — and adds the
   * sheet next to it.
   */
  fixed?: boolean;
  /** Closes the sheet: a tap on the scrim, or Escape. */
  onDismiss?: () => void;
  /** Classes of the white panel, e.g. its bottom padding. */
  className?: string;
  descriptionClassName?: string;
  /** Classes of the scrim, e.g. a lighter `bg-black/35` where drawn so. */
  scrimClassName?: string;
};

/**
 * A bottom sheet over a 40 % black scrim: a question that must be answered
 * before going on, asked where the thumb already is.
 *
 * The scrim covers the whole device, status bar included, as in the mockups;
 * hence the z-index over the Storybook chrome (the app has none of it).
 */
export function Sheet({
  title,
  description,
  children,
  behind,
  fixed = false,
  onDismiss,
  className,
  descriptionClassName,
  scrimClassName,
}: SheetProps) {
  const titleId = useId();
  useEffect(() => {
    if (!onDismiss) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);
  const overlay = (
    <div
      className={cn(
        'inset-0 z-[60] flex flex-col justify-end bg-black/40',
        fixed ? 'fixed' : 'absolute',
        scrimClassName,
      )}
    >
      {onDismiss && (
        <button
          type="button"
          aria-label="Fermer"
          className="min-h-0 flex-1 cursor-default"
          onClick={onDismiss}
        />
      )}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          // Scrolls rather than losing its title off the top when a long
          // sheet meets a short phone (375 × 667).
          'mx-auto flex max-h-full w-full max-w-[480px] flex-col overflow-y-auto rounded-t-sheet bg-white px-5 pt-2 pb-[calc(var(--safe-bottom)+18px)] text-ink',
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="mx-auto h-[5px] w-10 shrink-0 rounded-[3px] bg-border"
        />
        <h2 id={titleId} className="mt-[15px] text-22 font-bold">
          {title}
        </h2>
        {description && (
          <p className={cn('mt-2.5 text-15 text-muted', descriptionClassName)}>
            {description}
          </p>
        )}
        {children}
      </section>
    </div>
  );
  if (fixed) return overlay;
  return (
    <div className="relative h-full min-h-dvh w-full overflow-hidden">
      {behind}
      {overlay}
    </div>
  );
}
