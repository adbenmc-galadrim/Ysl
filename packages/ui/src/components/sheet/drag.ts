/** Below this, a finger on the sheet is a tap that trembled, not a drag. */
export const DRAG_SLOP = 8;

/**
 * Whether a sheet let go after a drag closes or settles back: pulled past
 * a third of its height (120 px at most), or flicked down.
 */
export function releasesSheet(
  offset: number,
  velocity: number,
  height: number,
): boolean {
  if (offset >= Math.min(120, height / 3)) return true;
  return velocity > 0.5 && offset > 24;
}

/** A finger held still before it lets go has stopped: no flick. */
export const FLICK_WINDOW_MS = 100;

/** The speed the sheet is let go at: the last move's, unless the finger rested since. */
export function releaseVelocity(
  velocity: number,
  lastMoveAt: number,
  releasedAt: number,
): number {
  return releasedAt - lastMoveAt > FLICK_WINDOW_MS ? 0 : velocity;
}
