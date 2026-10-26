import { describe, expect, it } from 'vitest';
import {
  clampView,
  doubleTapView,
  fitSize,
  MAX_SCALE,
  pinchView,
  RESTING,
  zoomAt,
} from '#components/photo-viewer/zoom';

const frame = { width: 390, height: 700 };
const picture = { width: 390, height: 292.5 };

describe('photo zoom', () => {
  it('fits a landscape photo to the width of a portrait frame', () => {
    expect(fitSize({ width: 1600, height: 1200 }, frame)).toEqual(picture);
  });

  it('keeps a pinch between the whole photo and four times', () => {
    const a = { x: -50, y: 0 };
    const b = { x: 50, y: 0 };
    const apart = pinchView(
      RESTING,
      { a, b },
      { a: { x: -500, y: 0 }, b: { x: 500, y: 0 } },
    );
    expect(apart.scale).toBe(MAX_SCALE);
    const together = pinchView(
      RESTING,
      { a, b },
      { a: { x: -10, y: 0 }, b: { x: 10, y: 0 } },
    );
    expect(together.scale).toBe(1);
  });

  it('keeps the spot under the fingers where it was', () => {
    const view = zoomAt(RESTING, 2, { x: 100, y: 50 });
    expect(view).toEqual({ scale: 2, x: -100, y: -50 });
  });

  it('never lets the zoomed photo slide off an edge', () => {
    const view = clampView({ scale: 2, x: 999, y: 999 }, frame, picture);
    expect(view.x).toBe(195);
    expect(view.y).toBe(0);
  });

  it('zooms in on a double tap, and back out on the next', () => {
    const zoomed = doubleTapView(RESTING, { x: 40, y: 0 });
    expect(zoomed.scale).toBeGreaterThan(1);
    expect(doubleTapView(zoomed, { x: 0, y: 0 })).toEqual(RESTING);
  });
});
