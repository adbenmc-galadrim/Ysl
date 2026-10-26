export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

/**
 * Where the picture sits: its scale and how far its centre moved from the
 * frame's centre, in screen pixels (`translate(x, y) scale(s)`).
 */
export type View = { scale: number; x: number; y: number };

export const RESTING: View = { scale: 1, x: 0, y: 0 };

/** Past four times, a phone photo of a label is only bigger noise. */
export const MAX_SCALE = 4;
/** A double tap brings the tapped corner close enough to read a line. */
export const DOUBLE_TAP_SCALE = 2.5;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(1, scale));
}

/** The picture at scale 1: the whole photo in the frame, letterboxed. */
export function fitSize(natural: Size, frame: Size): Size {
  if (natural.width <= 0 || natural.height <= 0) return frame;
  const ratio = Math.min(
    frame.width / natural.width,
    frame.height / natural.height,
  );
  return { width: natural.width * ratio, height: natural.height * ratio };
}

/**
 * Keeps the zoomed picture over the frame: it may not slide away and leave
 * a black edge where there is more photo to show. Unzoomed, it is centred.
 */
export function clampView(view: View, frame: Size, picture: Size): View {
  const scale = clampScale(view.scale);
  const slackX = Math.max(0, (picture.width * scale - frame.width) / 2);
  const slackY = Math.max(0, (picture.height * scale - frame.height) / 2);
  return {
    scale,
    x: Math.min(slackX, Math.max(-slackX, view.x)),
    y: Math.min(slackY, Math.max(-slackY, view.y)),
  };
}

/**
 * Zooms about a point given from the frame's centre (the fingers' midpoint,
 * a double tap): the bit of photo under it stays under it.
 */
export function zoomAt(view: View, scale: number, point: Point): View {
  const next = clampScale(scale);
  const factor = next / view.scale;
  return {
    scale: next,
    x: point.x - (point.x - view.x) * factor,
    y: point.y - (point.y - view.y) * factor,
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * The view a pinch leads to: the scale follows the spread of the fingers,
 * the photo follows their midpoint as it moves.
 */
export function pinchView(
  start: View,
  from: { a: Point; b: Point },
  to: { a: Point; b: Point },
): View {
  const spread = distance(from.a, from.b);
  if (spread <= 0) return start;
  const origin = midpoint(from.a, from.b);
  const centre = midpoint(to.a, to.b);
  const zoomed = zoomAt(
    start,
    (start.scale * distance(to.a, to.b)) / spread,
    origin,
  );
  return {
    ...zoomed,
    x: zoomed.x + centre.x - origin.x,
    y: zoomed.y + centre.y - origin.y,
  };
}

/** What a double tap does: back to the whole photo, or into the tapped spot. */
export function doubleTapView(view: View, point: Point): View {
  return view.scale > 1 ? RESTING : zoomAt(view, DOUBLE_TAP_SCALE, point);
}
