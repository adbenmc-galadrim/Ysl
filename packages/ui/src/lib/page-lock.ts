import { useEffect } from 'react';

/** What deciding on a scroll needs of an element; the DOM's and a test's both fit. */
export type ScrollBox = {
  parentElement: ScrollBox | null;
  scrollHeight: number;
  clientHeight: number;
};

/**
 * Whether a one-finger move from `target` scrolls something of its own: a
 * box set to scroll whose content is taller than it. Anything else would
 * only drag the page, which a locked screen refuses.
 */
export function scrollsInside(
  target: ScrollBox | null,
  overflowY: (box: ScrollBox) => string,
): boolean {
  for (let box = target; box; box = box.parentElement) {
    const overflow = overflowY(box);
    if (
      (overflow === 'auto' || overflow === 'scroll') &&
      box.scrollHeight > box.clientHeight + 1
    ) {
      return true;
    }
  }
  return false;
}

const computedOverflow = (box: ScrollBox) =>
  getComputedStyle(box as unknown as Element).overflowY;

function engage(): () => void {
  const { documentElement: html, body } = document;
  const saved = [
    html.style.overflow,
    html.style.overscrollBehavior,
    body.style.overflow,
    body.style.overscrollBehavior,
  ] as const;
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  const onTouchMove = (event: TouchEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.touches.length > 1 || !scrollsInside(target, computedOverflow)) {
      event.preventDefault();
    }
  };
  const onGesture = (event: Event) => event.preventDefault();
  const options = { passive: false } as const;
  document.addEventListener('touchmove', onTouchMove, options);
  document.addEventListener('gesturestart', onGesture, options);
  document.addEventListener('gesturechange', onGesture, options);
  return () => {
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('gesturestart', onGesture);
    document.removeEventListener('gesturechange', onGesture);
    [
      html.style.overflow,
      html.style.overscrollBehavior,
      body.style.overflow,
      body.style.overscrollBehavior,
    ] = saved;
  };
}

let holders = 0;
let release: (() => void) | undefined;

/**
 * Freezes the page under a screen that owns every gesture — the camera, a
 * sheet: no pinch zoom, no rubber band, no drag of the page behind. Only
 * that screen: elsewhere the page zooms as the brief asks (no
 * `user-scalable=no`). Locks nest; the last one released frees the page.
 */
export function lockPage(): () => void {
  if (holders++ === 0) release = engage();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--holders === 0) {
      release?.();
      release = undefined;
    }
  };
}

/** `lockPage` while mounted and `active`. */
export function usePageLock(active = true): void {
  useEffect(() => (active ? lockPage() : undefined), [active]);
}
