import { type PointerEvent, useEffect, useRef } from 'react';

/** How long a finger rests on a row before it counts as a long press (iOS: about half a second). */
export const LONG_PRESS_MS = 500;

/** A finger that slides further than this is scrolling, not pressing. */
const SLOP_PX = 10;

type Press = { x: number; y: number; timer: ReturnType<typeof setTimeout> };

/**
 * The handlers of an element that answers a long press: the press fires
 * after `LONG_PRESS_MS` without the finger moving away, and the click
 * that follows the lift is swallowed so the row does not also open.
 */
export function useLongPress(onLongPress: (() => void) | undefined) {
  const press = useRef<Press | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(
    () => () => {
      if (press.current) clearTimeout(press.current.timer);
    },
    [],
  );

  if (!onLongPress) return undefined;
  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      cancel();
      fired.current = false;
      press.current = {
        x: event.clientX,
        y: event.clientY,
        timer: setTimeout(() => {
          press.current = null;
          fired.current = true;
          onLongPress();
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove: (event: PointerEvent) => {
      const start = press.current;
      if (
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP_PX
      ) {
        cancel();
      }
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (event: { preventDefault: () => void }) =>
      event.preventDefault(),
  };
  /** True once: the click after a long press is not a tap. */
  const swallowClick = () => {
    const swallow = fired.current;
    fired.current = false;
    return swallow;
  };
  return { handlers, swallowClick };
}
