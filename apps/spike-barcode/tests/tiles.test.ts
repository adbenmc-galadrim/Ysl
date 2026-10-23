import { describe, expect, it } from 'vitest';
import {
  MAX_CANVAS_PIXELS,
  cropRaster,
  dedupeSymbols,
  planTiles,
  readTiles,
} from '../src/decode/tiles.ts';
import type { Raster, Symbol } from '../src/decode/zxing.ts';

const quad = (x: number, y: number, size: number) => ({
  topLeft: { x, y },
  topRight: { x: x + size, y },
  bottomRight: { x: x + size, y: y + size },
  bottomLeft: { x, y: y + size },
});

const symbol = (text: string, x: number, y: number, size = 100): Symbol => ({
  format: 'Code128',
  text,
  isValid: true,
  position: quad(x, y, size),
  orientation: 0,
});

describe('planTiles', () => {
  it('covers the whole image with overlap on a 3024x4032 photo', () => {
    const tiles = planTiles(3024, 4032, { tileSize: 2048, overlap: 512 });
    const covered = new Uint8Array((3024 / 8) * (4032 / 8));
    expect(tiles.length).toBeGreaterThan(1);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(3024);
      expect(t.y + t.height).toBeLessThanOrEqual(4032);
      for (let y = t.y; y < t.y + t.height; y += 8)
        for (let x = t.x; x < t.x + t.width; x += 8)
          covered[((y / 8) | 0) * (3024 / 8) + ((x / 8) | 0)] = 1;
    }
    expect(covered.every((v) => v === 1)).toBe(true);
    const xs = [...new Set(tiles.map((t) => t.x))].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i - 1]! + 2048 - xs[i]!).toBeGreaterThanOrEqual(512);
    }
  });

  it('keeps every tile under 16.7 Mpx even with a huge tile size', () => {
    for (const t of planTiles(12000, 9000, { tileSize: 10000, overlap: 600 })) {
      expect(t.width * t.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    }
    for (const t of planTiles(3024, 4032, { tileSize: 4096 })) {
      expect(t.width * t.height).toBeLessThan(MAX_CANVAS_PIXELS);
    }
  });

  it('returns a single tile for a small image', () => {
    expect(planTiles(1200, 800)).toEqual([
      { x: 0, y: 0, width: 1200, height: 800 },
    ]);
    expect(planTiles(2048, 2048)).toHaveLength(1);
  });
});

describe('cropRaster', () => {
  it('copies the right pixels', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 16; i++) data[i * 4] = i;
    const raster: Raster = { data, width: 4, height: 4 };
    const crop = cropRaster(raster, { x: 1, y: 2, width: 2, height: 2 });
    expect([...crop.data].filter((_, i) => i % 4 === 0)).toEqual([
      9, 10, 13, 14,
    ]);
  });
});

describe('dedupeSymbols', () => {
  it('merges the same symbol read on two tiles, keeps distinct ones', () => {
    const merged = dedupeSymbols([
      symbol('A', 1500, 900),
      symbol('A', 1503, 898),
      symbol('A', 200, 3000),
      symbol('B', 1500, 900),
    ]);
    expect(merged.map((s) => s.text)).toEqual(['A', 'A', 'B']);
  });
});

describe('readTiles', () => {
  it('reads a symbol cut by one tile border from the tile that holds it, once', async () => {
    const raster: Raster = {
      data: new Uint8ClampedArray(3000 * 3000 * 4),
      width: 3000,
      height: 3000,
    };
    const target = { x: 1700, y: 1000, size: 300 };
    const seen: number[] = [];
    const symbols = await readTiles(
      raster,
      (tile) => {
        seen.push(tile.width * tile.height);
        return Promise.resolve([]);
      },
      { tileSize: 2048, overlap: 512 },
    );
    expect(symbols).toEqual([]);
    expect(seen.length).toBe(4);
    const rects = planTiles(3000, 3000, { tileSize: 2048, overlap: 512 });
    const found = await readTiles(
      raster,
      (() => {
        let i = 0;
        return () => {
          const r = rects[i++]!;
          const inside =
            target.x >= r.x &&
            target.x + target.size <= r.x + r.width &&
            target.y >= r.y &&
            target.y + target.size <= r.y + r.height;
          return Promise.resolve(
            inside
              ? [symbol('X', target.x - r.x, target.y - r.y, target.size)]
              : [],
          );
        };
      })(),
      { tileSize: 2048, overlap: 512 },
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.position.topLeft).toEqual({ x: 1700, y: 1000 });
  });
});
