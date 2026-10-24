import { describe, expect, it } from 'vitest';
import {
  decodeSource,
  enoughFormats,
  type CascadeReaders,
  type RasterSource,
  type StepName,
  type Symbol,
} from '#index';

const WIDTH = 2600;
const HEIGHT = 1000;

const sourceOf = (width = WIDTH, height = HEIGHT) => {
  const sides: number[] = [];
  const source: RasterSource = {
    width,
    height,
    raster: (maxSide) => {
      sides.push(maxSide);
      const factor = Math.min(1, maxSide / Math.max(width, height));
      const w = Math.floor(width * factor);
      const h = Math.floor(height * factor);
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    },
  };
  return { source, sides };
};

const symbolAt = (
  width: number,
  text: string,
  format = 'Code128',
  fraction = 0.1,
): Symbol => {
  const x = width * fraction;
  const size = width * 0.05;
  return {
    format,
    text,
    isValid: true,
    position: {
      topLeft: { x, y: x },
      topRight: { x: x + size, y: x },
      bottomRight: { x: x + size, y: x + size },
      bottomLeft: { x, y: x + size },
    },
    orientation: 0,
  };
};

const readers = (
  read: (width: number) => Symbol[],
): CascadeReaders & { calls: number[] } => {
  const calls: number[] = [];
  return {
    calls,
    all: (raster) => {
      calls.push(raster.width);
      return Promise.resolve(read(raster.width));
    },
    maxicode: () => Promise.resolve([]),
  };
};

const names = (steps: { name: StepName }[]) => steps.map((s) => s.name);

describe('decodeSource', () => {
  it('stops after the first pass that reads something', async () => {
    const { source, sides } = sourceOf();
    const result = await decodeSource(
      source,
      {},
      readers((w) => (w === 1600 ? [symbolAt(w, 'A')] : [])),
    );
    expect(names(result.steps)).toEqual(['whole-1600']);
    expect(sides).toEqual([1600]);
    expect(result.symbols.map((s) => s.text)).toEqual(['A']);
  });

  it('skips the 2400 pass when the image is not larger than 1600', async () => {
    const { source, sides } = sourceOf(1500, 1000);
    const result = await decodeSource(
      source,
      {},
      readers(() => []),
    );
    expect(sides).toEqual([1600, Infinity]);
    expect(names(result.steps)).toEqual(['whole-1600', 'tiles', 'maxicode']);
  });

  it('goes on to tiles then MaxiCode when nothing is read', async () => {
    const { source } = sourceOf();
    const result = await decodeSource(
      source,
      {},
      readers(() => []),
    );
    expect(names(result.steps)).toEqual([
      'whole-1600',
      'whole-2400',
      'tiles',
      'maxicode',
    ]);
    expect(result.symbols).toEqual([]);
    expect(result.width).toBe(WIDTH);
    expect(result.height).toBe(HEIGHT);
  });

  it('plays every pass in thorough mode and merges symbols without duplicates', async () => {
    const { source } = sourceOf();
    const result = await decodeSource(
      source,
      { thorough: true },
      readers((w) => (w === 1600 || w === 2400 ? [symbolAt(w, 'A')] : [])),
    );
    expect(names(result.steps)).toEqual([
      'whole-1600',
      'whole-2400',
      'tiles',
      'maxicode',
    ]);
    expect(result.symbols).toHaveLength(1);
  });

  it('skips the MaxiCode pass when a MaxiCode is already read', async () => {
    const { source } = sourceOf();
    const result = await decodeSource(
      source,
      { thorough: true },
      readers((w) => (w === 1600 ? [symbolAt(w, 'M', 'MaxiCode')] : [])),
    );
    expect(names(result.steps)).not.toContain('maxicode');
    expect(names(result.steps)).toContain('tiles');
  });

  it('maps positions back to the original image scale', async () => {
    const { source } = sourceOf();
    const result = await decodeSource(
      source,
      {},
      readers((w) => (w === 1600 ? [symbolAt(w, 'A')] : [])),
    );
    const topLeft = result.symbols[0]!.position.topLeft;
    expect(topLeft.x).toBeCloseTo(160 * (WIDTH / 1600));
    expect(topLeft.y).toBeCloseTo(160 * (WIDTH / 1600));
  });

  it('honours a custom enough predicate', async () => {
    const { source } = sourceOf();
    const result = await decodeSource(
      source,
      { enough: (found) => found.length >= 2 },
      readers((w) => {
        if (w === 1600) return [symbolAt(w, 'A')];
        if (w === 2400) return [symbolAt(w, 'B', 'QRCode', 0.5)];
        return [];
      }),
    );
    expect(names(result.steps)).toEqual(['whole-1600', 'whole-2400']);
    expect(result.symbols.map((s) => s.text).sort()).toEqual(['A', 'B']);
  });

  it('stops only once every expected format is read', async () => {
    const { source } = sourceOf();
    const read = readers((w) =>
      w === 1600
        ? [symbolAt(w, 'A')]
        : [symbolAt(w, 'A'), symbolAt(w, 'B', 'Aztec', 0.5)],
    );
    const result = await decodeSource(
      source,
      { enough: enoughFormats(['Code128', 'Aztec']) },
      read,
    );
    expect(names(result.steps)).toEqual(['whole-1600', 'whole-2400']);
    expect(result.symbols.map((s) => s.format).sort()).toEqual([
      'Aztec',
      'Code128',
    ]);
  });
});
