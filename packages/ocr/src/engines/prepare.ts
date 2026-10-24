/** Working size of the OCR: the long side of the photo, as measured in spike S3. */
export const MAX_SIDE = 1600;

export type Prepared = {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
};

export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Decodes the photo with its EXIF orientation and shrinks it to the working size. */
export async function prepare(
  blob: Blob,
  maxSide: number = MAX_SIDE,
): Promise<Prepared> {
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: 'from-image',
  });
  try {
    const target = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = new OffscreenCanvas(target.width, target.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D unavailable');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    return {
      canvas,
      width: target.width,
      height: target.height,
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

/** A label-like picture for the blank inference that warms the sessions up. */
export function warmupCanvas(): OffscreenCanvas {
  const canvas = new OffscreenCanvas(960, 640);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  context.font = '48px sans-serif';
  context.fillText('DESTINATAIRE', 60, 120);
  context.fillText('MARIE DUPONT', 60, 220);
  context.fillText('12 RUE DES LILAS', 60, 320);
  context.fillText('75011 PARIS FRANCE', 60, 420);
  return canvas;
}
