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
    if (!context) throw new Error('contexte 2d indisponible');
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

export function warmupCanvas(): OffscreenCanvas {
  const canvas = new OffscreenCanvas(960, 640);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('contexte 2d indisponible');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  context.font = '48px sans-serif';
  context.fillText('MARIE DUPONT', 60, 160);
  context.fillText('12 RUE DES LILAS', 60, 280);
  context.fillText('75011 PARIS FRANCE', 60, 400);
  return canvas;
}
