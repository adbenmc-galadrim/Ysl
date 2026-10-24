/**
 * Why a shot could not be read, when it could not (F05): too blurry, or a
 * glare on the label. Measured on a small thumbnail of the frame right
 * after the grab, for every shot, and only shown when no code was read.
 */

/** `blurry` covers a frame with nothing in it: no edge at all, as a smear. */
export type FrameVerdict = 'ok' | 'blurry' | 'glare';

export type FrameQuality = {
  /**
   * Variance of the Laplacian of the luminance over the variance of the
   * luminance: the edges' share of the contrast, low when nothing is sharp.
   */
  sharpness: number;
  /** Share of saturated pixels in the middle of the frame, 0 to 1. */
  glare: number;
  verdict: FrameVerdict;
};

export type RgbaImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/**
 * Long side of the thumbnail the measures run on: a sixth of the stream,
 * where the blur that defeats the reader (σ ≈ 4 px on 4 032) still shows.
 */
export const THUMBNAIL_SIDE = 640;
/**
 * Below this, the edges carry too little of the contrast: the label is a
 * smear. Real labels of the corpus read 0.59 to 1.1 sharp, 0.17 to 0.31
 * once blurred past what zxing reads, 0.02 to 0.04 blurred twice as much.
 */
export const BLUR_BELOW = 0.25;
/** A white patch over this share of the middle hides what is under it. */
export const GLARE_ABOVE = 0.12;
/** A pixel this bright is burnt: paper under a lamp reads around 230. */
export const SATURATED = 250;
/** The middle of the frame, where the viewfinder puts the label. */
const MIDDLE = 0.5;

function luminance({ data, width, height }: RgbaImage): Uint8Array {
  const y = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < y.length; i += 1, p += 4) {
    y[i] = (77 * data[p]! + 150 * data[p + 1]! + 29 * data[p + 2]!) >> 8;
  }
  return y;
}

function variance(y: Uint8Array) {
  let sum = 0;
  let squares = 0;
  for (const value of y) {
    sum += value;
    squares += value * value;
  }
  const mean = sum / y.length;
  return squares / y.length - mean * mean;
}

/** Variance of the 4-neighbour Laplacian over the interior pixels. */
function laplacianVariance(y: Uint8Array, width: number, height: number) {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let squares = 0;
  let n = 0;
  for (let row = 1; row < height - 1; row += 1) {
    for (let col = 1; col < width - 1; col += 1) {
      const i = row * width + col;
      const value =
        4 * y[i]! - y[i - 1]! - y[i + 1]! - y[i - width]! - y[i + width]!;
      sum += value;
      squares += value * value;
      n += 1;
    }
  }
  const mean = sum / n;
  return squares / n - mean * mean;
}

/** Share of burnt pixels in the middle `MIDDLE` of each side. */
function saturatedShare(y: Uint8Array, width: number, height: number) {
  const left = Math.floor((width * (1 - MIDDLE)) / 2);
  const top = Math.floor((height * (1 - MIDDLE)) / 2);
  const right = width - left;
  const bottom = height - top;
  let burnt = 0;
  let n = 0;
  for (let row = top; row < bottom; row += 1) {
    for (let col = left; col < right; col += 1) {
      if (y[row * width + col]! >= SATURATED) burnt += 1;
      n += 1;
    }
  }
  return n === 0 ? 0 : burnt / n;
}

/**
 * The two measures and the verdict. A glare wins over a blur: a burnt
 * patch flattens the edges around it, and tilting the parcel is what
 * fixes both.
 */
export function assessFrame(image: RgbaImage): FrameQuality {
  const y = luminance(image);
  const contrast = variance(y);
  const sharpness =
    contrast === 0
      ? 0
      : laplacianVariance(y, image.width, image.height) / contrast;
  const glare = saturatedShare(y, image.width, image.height);
  const verdict: FrameVerdict =
    glare >= GLARE_ABOVE ? 'glare' : sharpness < BLUR_BELOW ? 'blurry' : 'ok';
  return { sharpness, glare, verdict };
}

/** The thumbnail of a frame, drawn with a 2D canvas; the bitmap stays open. */
export function frameQuality(bitmap: ImageBitmap): FrameQuality {
  const scale = Math.min(
    1,
    THUMBNAIL_SIDE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(3, Math.round(bitmap.width * scale));
  const height = Math.max(3, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { sharpness: 0, glare: 0, verdict: 'ok' };
  context.drawImage(bitmap, 0, 0, width, height);
  return assessFrame(context.getImageData(0, 0, width, height));
}
