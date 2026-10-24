import type { Raster, RasterSource } from '@repo/barcode';
import sharp, { type Sharp } from 'sharp';

export type BenchImage = { source: RasterSource; bytes: number };

/** What the viewfinder hands over on the iPhone (spike S1): 12 Mpx, JPEG 80. */
export const VIEWFINDER = { width: 3024, height: 4032, quality: 80 };

/** The sides `decodeSource` asks for, besides the full raster. */
const SIDES = [1600, 2400];

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
    { raw: { width: raster.width, height: raster.height, channels: 4 } },
  );

const longSide = (r: { width: number; height: number }) =>
  Math.max(r.width, r.height);

const asViewfinder = async (raster: Raster) => {
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

const resized = (full: Raster, side: number) =>
  rawOf(
    fromRaster(full).resize({
      width: side,
      height: side,
      fit: 'inside',
      kernel: 'lanczos3',
    }),
  );

/** `decodeSource` reads rasters synchronously: every size is prepared first. */
export const toSource = async (full: Raster): Promise<RasterSource> => {
  const scaled = new Map<number, Raster>();
  for (const side of SIDES) {
    if (longSide(full) > side) scaled.set(side, await resized(full, side));
  }
  return {
    width: full.width,
    height: full.height,
    raster: (maxSide) => {
      if (maxSide >= longSide(full)) return full;
      const hit = scaled.get(maxSide);
      if (hit === undefined) {
        throw new Error(`raster ${maxSide} px non préparé`);
      }
      return hit;
    },
  };
};

/** The raw RGBA raster of an encoded image, as zxing reads it. */
export const rasterOf = (image: Buffer) => rawOf(sharp(image));

export const openImage = async (
  path: string,
  { viewfinder = true } = {},
): Promise<BenchImage> => {
  const decoded = await rawOf(
    sharp(path).rotate().flatten({ background: '#ffffff' }),
  );
  const full = viewfinder ? await asViewfinder(decoded) : decoded;
  return { source: await toSource(full), bytes: full.data.byteLength };
};
