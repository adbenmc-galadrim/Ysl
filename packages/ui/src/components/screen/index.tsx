import type { ReactNode, Ref } from 'react';

import { cn } from '#lib/tv';

export type ScreenProps = {
  children: ReactNode;
  /** Pinned under the content: a `BottomBar`, a keypad, a sheet. */
  bottom?: ReactNode;
  /**
   * `white` for lists and forms, `night` for the camera, `fill` for the
   * settings screens, whose white grouped cards need a grey page to read.
   */
  tone?: 'white' | 'night' | 'fill';
  /**
   * Room left under the scrolling content so its last row clears the bottom
   * bar. 128 is the height of the standard bar with its fade.
   */
  bottomInset?: number;
  /** The scrolling column, for a list that renders only what is in view. */
  scrollRef?: Ref<HTMLDivElement>;
  className?: string;
};

/**
 * One app screen: full height, a scrolling column under the status bar and a
 * fixed bottom area. Width is fluid — 20 px gutters at every phone size, and
 * a centred 480 px column from tablet up so rows never stretch across a
 * desk screen.
 */
export function Screen({
  children,
  bottom,
  tone = 'white',
  bottomInset = 128,
  scrollRef,
  className,
}: ScreenProps) {
  return (
    <div
      data-tone={tone}
      className={cn(
        'relative h-full min-h-dvh w-full overflow-hidden',
        tone === 'white' && 'bg-white text-ink',
        tone === 'fill' && 'bg-fill text-ink',
        tone === 'night' && 'bg-night text-white',
      )}
    >
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto overscroll-contain"
      >
        <main
          className={cn(
            'mx-auto flex w-full max-w-[480px] flex-col px-5 pt-[calc(var(--safe-top)+8px)]',
            className,
          )}
          style={{ paddingBottom: bottom ? bottomInset : undefined }}
        >
          {children}
        </main>
      </div>
      {bottom && (
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[480px]">
          {bottom}
        </div>
      )}
    </div>
  );
}
