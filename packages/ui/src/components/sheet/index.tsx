import { useId, type ReactNode } from 'react';

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
  className,
  descriptionClassName,
  scrimClassName,
}: SheetProps) {
  const titleId = useId();
  return (
    <div className="relative h-full min-h-dvh w-full overflow-hidden">
      {behind}
      <div
        className={cn(
          'absolute inset-0 z-[60] flex flex-col justify-end bg-black/40',
          scrimClassName,
        )}
      >
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
            <p
              className={cn(
                'mt-2.5 text-15 text-muted',
                descriptionClassName,
              )}
            >
              {description}
            </p>
          )}
          {children}
        </section>
      </div>
    </div>
  );
}
