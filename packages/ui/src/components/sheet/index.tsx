import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';

import {
  DRAG_SLOP,
  releasesSheet,
  releaseVelocity,
} from '#components/sheet/drag';
import { usePageLock } from '#lib/page-lock';
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
   * sheet next to it. The page under it is locked while it is open.
   */
  fixed?: boolean;
  /** Closes the sheet: a tap on the scrim, a drag down, or Escape. */
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
 *
 * A finger on the sheet moves the sheet, never the page behind: over the
 * app (`fixed`) the page is locked while it is open, and a drag down closes
 * it. When a short phone makes the sheet scroll, only its handle and title
 * drag it; the rest scrolls.
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
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const scrolls = useScrolls(sectionRef);
  usePageLock(fixed);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      !onDismiss ||
      event.button !== 0 ||
      !event.isPrimary ||
      drag.current?.on
    ) {
      return;
    }
    if (scrolls && !headRef.current?.contains(event.target as Node)) return;
    drag.current = {
      id: event.pointerId,
      y: event.clientY,
      last: { y: event.clientY, t: event.timeStamp },
      velocity: 0,
      on: false,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dy = event.clientY - d.y;
    if (!d.on) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      if (dy < 0) {
        drag.current = null;
        return;
      }
      d.on = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const dt = event.timeStamp - d.last.t;
    if (dt > 0) d.velocity = (event.clientY - d.last.y) / dt;
    d.last = { y: event.clientY, t: event.timeStamp };
    setOffset(Math.max(0, dy));
  };
  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (!d.on) return;
    setDragging(false);
    const height = event.currentTarget.offsetHeight;
    const pulled = Math.max(0, event.clientY - d.y);
    if (
      event.type === 'pointerup' &&
      releasesSheet(
        pulled,
        releaseVelocity(d.velocity, d.last.t, event.timeStamp),
        height,
      )
    ) {
      onDismiss?.();
    }
    setOffset(0);
  };
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
        'inset-0 z-[60] flex touch-none flex-col justify-end overscroll-none bg-black/40',
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
        ref={sectionRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={
          offset > 0 ? { transform: `translateY(${offset}px)` } : undefined
        }
        className={cn(
          // Scrolls rather than losing its title off the top when a long
          // sheet meets a short phone (375 × 667).
          'mx-auto flex max-h-full w-full max-w-[480px] flex-col overflow-y-auto overscroll-contain rounded-t-sheet bg-white px-5 pt-2 pb-[calc(var(--safe-bottom)+18px)] text-ink',
          scrolls ? 'touch-pan-y' : 'touch-none',
          !dragging && 'transition-transform duration-200 ease-out',
          className,
        )}
      >
        <div ref={headRef} className="flex shrink-0 touch-none flex-col">
          <span
            aria-hidden="true"
            className="mx-auto h-[5px] w-10 shrink-0 rounded-[3px] bg-border"
          />
          <h2 id={titleId} className="mt-[15px] text-22 font-bold">
            {title}
          </h2>
        </div>
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

type Drag = {
  id: number;
  /** Where the finger came down. */
  y: number;
  last: { y: number; t: number };
  /** Downward speed at the last move, in px/ms. */
  velocity: number;
  /** Past the slop: the sheet follows the finger. */
  on: boolean;
};

/** Whether the sheet is taller than the screen lets it be, and scrolls. */
function useScrolls(ref: { current: HTMLElement | null }): boolean {
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () =>
      setScrolls(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  }, [ref]);
  return scrolls;
}
