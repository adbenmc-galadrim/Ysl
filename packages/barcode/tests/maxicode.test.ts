import bwipjs from 'bwip-js/node';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { locateBullseyes, readMaxiCode, straightenAll } from '#maxicode';
import { initZxingNode } from '#node';
import { readSymbols, type Raster } from '#zxing';

const SOURCE =
  '[)>^03001^02996750010000^029250^029011^0291ZAB12C30412345675^029UPSN^029AB12C3^029089^029^0291/1^02910^029N^029^029PARIS^029FR^030^004';
const EXPECTED = SOURCE.replaceAll('^029', '\u001d')
  .replaceAll('^030', '\u001e')
  .replaceAll('^004', '\u0004');

const RENDER = {
  bcid: 'maxicode',
  text: SOURCE,
  scale: 3,
  mode: 2,
  parse: true,
};

const WIDTH = 1400;
const HEIGHT = 1000;

const noise = (seed: number) => {
  let state = seed;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const data = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const base = 205 + (x / WIDTH) * 30 - (y / HEIGHT) * 20;
      const value = base + (next() - 0.5) * 70;
      const p = (y * WIDTH + x) * 3;
      data[p] = value;
      data[p + 1] = value;
      data[p + 2] = value;
    }
  }
  return data;
};

const label = async (
  angle: number,
  scale: number,
  at: { left: number; top: number },
): Promise<Raster> => {
  const symbol = await bwipjs.toBuffer(RENDER);
  const placed = await sharp(symbol)
    .flatten({ background: '#ffffff' })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' })
    .rotate(angle, { background: '#ffffff' })
    .resize({ width: Math.round(380 * scale) })
    .png()
    .toBuffer();
  const { data, info } = await sharp(noise(angle + 7), {
    raw: { width: WIDTH, height: HEIGHT, channels: 3 },
  })
    .composite([{ input: placed, ...at }])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  };
};

const readWhole = (raster: Raster) =>
  readSymbols(raster, { formats: ['MaxiCode'] });

const readPure = (raster: Raster) =>
  readSymbols(raster, { formats: ['MaxiCode'], isPure: true });

describe('MaxiCode crop', () => {
  beforeAll(async () => {
    await initZxingNode();
  });

  it.each([15, 45, 90])(
    'reads a MaxiCode rotated by %i degrees, reduced, on a noisy label, only with the crop',
    async (angle) => {
      const raster = await label(angle, 0.6, { left: 760, top: 410 });
      expect(await readWhole(raster)).toEqual([]);
      const read = await readMaxiCode(raster, readPure);
      expect(read).not.toBeNull();
      expect(read!.symbols[0]!.format).toBe('MaxiCode');
      expect(read!.symbols[0]!.text).toBe(EXPECTED);
    },
  );

  it('locates the bullseye where the symbol was placed', async () => {
    const raster = await label(45, 0.6, { left: 200, top: 150 });
    const { bullseyes } = locateBullseyes(raster);
    expect(bullseyes).toHaveLength(1);
    expect(bullseyes[0]!.x).toBeGreaterThan(200);
    expect(bullseyes[0]!.x).toBeLessThan(200 + 380 * 0.6 * 1.5);
    expect(bullseyes[0]!.unit).toBeGreaterThan(3.5);
    expect(bullseyes[0]!.unit).toBeLessThan(6);
  });

  it('finds nothing on a label without a MaxiCode', async () => {
    const data = noise(3);
    const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      rgba.set([data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!, 255], i * 4);
    }
    const blank = { data: rgba, width: WIDTH, height: HEIGHT };
    expect(locateBullseyes(blank).bullseyes).toEqual([]);
    expect(await readMaxiCode(blank, readPure)).toBeNull();
  });

  it('produces six upright candidates per bullseye', async () => {
    const raster = await label(15, 0.6, { left: 300, top: 300 });
    const candidates = straightenAll(locateBullseyes(raster));
    expect(candidates).toHaveLength(6);
    for (const c of candidates) {
      expect(c.raster.width).toBeGreaterThan(300);
    }
  });
});
