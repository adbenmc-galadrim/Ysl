import bwipjs from 'bwip-js/node';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { initZxing, readSymbols, type Raster } from '#index';
import { initZxingNode } from '#node';

const WIDTH = 3000;
const HEIGHT = 4000;

const render = async (options: Parameters<typeof bwipjs.toBuffer>[0]) =>
  sharp(await bwipjs.toBuffer(options))
    .flatten({ background: '#ffffff' })
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: '#ffffff' })
    .png()
    .toBuffer();

const label = async (): Promise<Raster> => {
  const [code128, dataMatrix, qr] = await Promise.all([
    render({
      bcid: 'code128',
      text: 'SYNTH-CODE128-0001',
      scale: 6,
      height: 20,
    }),
    render({ bcid: 'datamatrix', text: 'SYNTH-DM-0002', scale: 14 }),
    render({ bcid: 'qrcode', text: 'SYNTH-QR-0003', scale: 14 }),
  ]);
  const { data, info } = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite([
      { input: code128, left: 200, top: 300 },
      { input: dataMatrix, left: 300, top: 1500 },
      { input: qr, left: 1500, top: 2500 },
    ])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  };
};

describe('readSymbols', () => {
  beforeAll(async () => {
    await initZxingNode();
  });

  it('reads a Code 128, a Data Matrix and a QR code in one pass', async () => {
    const symbols = await readSymbols(await label());
    const read = symbols.map((s) => [s.format, s.text]);
    expect(read).toHaveLength(3);
    expect(read).toEqual(
      expect.arrayContaining([
        ['Code128', 'SYNTH-CODE128-0001'],
        ['DataMatrix', 'SYNTH-DM-0002'],
        ['QRCode', 'SYNTH-QR-0003'],
      ]),
    );
  });
});

describe('initZxing', () => {
  it('rejects when the wasm cannot be found instead of falling back to a CDN', async () => {
    const missing = 'http://127.0.0.1:1/missing.wasm';
    const requested: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input) => {
      requested.push(String(input instanceof Request ? input.url : input));
      return Promise.reject(new Error('offline'));
    };
    try {
      await expect(initZxing({ wasmUrl: missing })).rejects.toThrow();
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(requested.length).toBeGreaterThan(0);
    expect(new Set(requested)).toEqual(new Set([missing]));
    await initZxingNode();
  });
});
