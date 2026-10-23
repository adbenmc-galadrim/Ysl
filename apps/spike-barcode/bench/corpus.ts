import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { readManifest, type Located } from '@repo/corpus/src/manifest.ts';
import type { Raster } from '../src/decode/zxing.ts';

export type BenchLabel = Located;

export type BenchImage = {
  raster: Raster;
  resized: (longSide: number) => Promise<Raster>;
  viewfinder: () => Promise<BenchImage>;
};

export type CorpusPaths = {
  corpus: string;
  privateDir?: string;
  cache: string;
};

const manifests = [
  { source: 'synthetic', file: 'synthetic/labels.json' },
  { source: 'web', file: 'web/labels.json' },
];

export const loadLabels = ({
  corpus,
  privateDir,
}: CorpusPaths): BenchLabel[] => {
  const labels = manifests.flatMap(({ file }) => {
    const path = join(corpus, file);
    return existsSync(path) ? readManifest(path) : [];
  });
  if (privateDir) {
    const path = join(privateDir, 'annotations.json');
    if (existsSync(path)) labels.push(...readManifest(path));
  }
  return labels;
};

export const toReadablePath = (path: string, cache: string) => {
  const ext = extname(path).toLowerCase();
  if (ext !== '.heic' && ext !== '.heif') return path;
  mkdirSync(cache, { recursive: true });
  const key = createHash('sha1').update(readFileSync(path)).digest('hex');
  const target = join(
    cache,
    `${basename(path, extname(path))}-${key.slice(0, 8)}.jpg`,
  );
  if (!existsSync(target)) {
    execFileSync('sips', ['-s', 'format', 'jpeg', path, '--out', target], {
      stdio: 'ignore',
    });
  }
  return target;
};

const toRaster = (
  data: Buffer,
  info: { width: number; height: number },
): Raster => ({
  data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  width: info.width,
  height: info.height,
});

const rawOf = async (input: Sharp) => {
  const { data, info } = await input
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return toRaster(data, info);
};

const fromRaster = (raster: Raster) =>
  sharp(
    Buffer.from(
      raster.data.buffer,
      raster.data.byteOffset,
      raster.data.byteLength,
    ),
    {
      raw: { width: raster.width, height: raster.height, channels: 4 },
    },
  );

export const VIEWFINDER = { width: 3024, height: 4032, quality: 80 };

const makeImage = (
  raster: Raster,
  simulate: (() => Promise<Raster>) | null,
): BenchImage => {
  const cache = new Map<number, Raster>();
  let viewfinder: BenchImage | null = null;
  return {
    raster,
    resized: async (longSide) => {
      if (Math.max(raster.width, raster.height) <= longSide) return raster;
      const hit = cache.get(longSide);
      if (hit) return hit;
      const out = await rawOf(
        fromRaster(raster).resize({
          width: longSide,
          height: longSide,
          fit: 'inside',
          kernel: 'lanczos3',
        }),
      );
      cache.set(longSide, out);
      return out;
    },
    viewfinder: async () => {
      viewfinder ??= makeImage(
        await (simulate ?? (() => Promise.resolve(raster)))(),
        null,
      );
      return viewfinder;
    },
  };
};

const simulateViewfinder = (raster: Raster) => async () => {
  const portrait = raster.height >= raster.width;
  const jpeg = await fromRaster(raster)
    .removeAlpha()
    .resize({
      width: portrait ? VIEWFINDER.width : VIEWFINDER.height,
      height: portrait ? VIEWFINDER.height : VIEWFINDER.width,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: VIEWFINDER.quality })
    .toBuffer();
  return rawOf(sharp(jpeg));
};

export const openImage = async (path: string): Promise<BenchImage> => {
  const raster = await rawOf(
    sharp(path).rotate().flatten({ background: '#ffffff' }),
  );
  return makeImage(raster, simulateViewfinder(raster));
};
