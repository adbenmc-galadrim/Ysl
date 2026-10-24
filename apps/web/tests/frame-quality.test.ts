import { describe, expect, it } from 'vitest';
import {
  assessFrame,
  BLUR_BELOW,
  GLARE_ABOVE,
  type RgbaImage,
} from '#/features/camera/quality';

/**
 * A frame painted by a function of the pixel: one grey value for the three
 * channels, or a colour as `[r, g, b]`.
 */
const frame = (
  width: number,
  height: number,
  paint: (x: number, y: number) => number | [number, number, number],
): RgbaImage => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 4;
      const value = paint(x, y);
      const [r, g, b] =
        typeof value === 'number' ? [value, value, value] : value;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
  }
  return { data, width, height };
};

/** Printed label: black 4 px bars on light paper, never burnt. */
const bars = (x: number) => (Math.floor(x / 4) % 2 === 0 ? 20 : 230);

describe('assessFrame', () => {
  it('reads a printed label as sharp and without glare', () => {
    const quality = assessFrame(frame(120, 90, bars));
    expect(quality.sharpness).toBeGreaterThan(BLUR_BELOW);
    expect(quality.glare).toBe(0);
    expect(quality.verdict).toBe('ok');
  });

  it('reads the edges of every channel, not of the red one alone', () => {
    const greenBars = frame(120, 90, (x) =>
      Math.floor(x / 4) % 2 === 0 ? [40, 20, 40] : [40, 230, 40],
    );
    expect(assessFrame(greenBars).verdict).toBe('ok');
  });

  it('reads a smooth gradient as blurry', () => {
    const quality = assessFrame(frame(120, 90, (x) => Math.round(x * 1.5)));
    expect(quality.sharpness).toBeLessThan(BLUR_BELOW);
    expect(quality.verdict).toBe('blurry');
  });

  it('reads a burnt patch over the middle as a glare, before any blur', () => {
    const burnt = (x: number, y: number) =>
      x >= 40 && x < 80 && y >= 30 && y < 60 ? 255 : bars(x);
    const sharp = assessFrame(frame(120, 90, burnt));
    expect(sharp.glare).toBeGreaterThanOrEqual(GLARE_ABOVE);
    expect(sharp.verdict).toBe('glare');

    expect(assessFrame(frame(120, 90, () => 200)).verdict).toBe('blurry');
    const smeared = assessFrame(
      frame(120, 90, (x, y) =>
        x >= 40 && x < 80 && y >= 30 && y < 60 ? 255 : 200,
      ),
    );
    expect(smeared.verdict).toBe('glare');
  });

  it('ignores a burnt patch in a corner, and bright paper that is not burnt', () => {
    const corner = assessFrame(
      frame(120, 90, (x, y) => (x < 20 && y < 20 ? 255 : bars(x))),
    );
    expect(corner.glare).toBe(0);
    expect(corner.verdict).toBe('ok');

    const bright = assessFrame(
      frame(120, 90, (x) => (Math.floor(x / 4) % 2 === 0 ? 20 : 248)),
    );
    expect(bright.glare).toBe(0);
    expect(bright.verdict).toBe('ok');
  });
});
