import { fitWithin } from '#/features/camera/capture';
import type { DecodeQueue } from '#/features/scan/decode-queue';

/** A look at the frame this often: the QR is read before the arm is still. */
export const QR_SCAN_INTERVAL_MS = 400;

/** Long side of the frame handed to the Worker: a QR at arm's length stays sharp. */
export const QR_FRAME_SIDE = 1280;

/**
 * The frame on screen, shrunk: the stream films at 12 Mpx for the labels,
 * which a QR held up to the counter does not need, every 400 ms. A label
 * checked at the counter is held close, and is read at this size too.
 */
export function grabVideoFrame(video: HTMLVideoElement): Promise<ImageBitmap> {
  const { width, height } = fitWithin(
    video.videoWidth,
    video.videoHeight,
    QR_FRAME_SIDE,
  );
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) return createImageBitmap(video);
  context.drawImage(video, 0, 0, width, height);
  return Promise.resolve(canvas.transferToImageBitmap());
}

/** The codes in one frame of the viewfinder, read by the barcode Worker. */
export async function readFrameTexts(
  queue: DecodeQueue,
  grab: () => Promise<ImageBitmap>,
): Promise<string[]> {
  await queue.acquire();
  try {
    const result = await queue.decode(await grab());
    return result.symbols.map((symbol) => symbol.text);
  } finally {
    queue.release();
  }
}

/**
 * The texts of the QR codes in one frame of the viewfinder, read by the
 * barcode Worker.
 */
export async function readQrTexts(
  queue: DecodeQueue,
  grab: () => Promise<ImageBitmap>,
): Promise<string[]> {
  await queue.acquire();
  try {
    const result = await queue.decode(await grab(), { expect: ['QRCode'] });
    return result.symbols
      .filter((symbol) => symbol.format === 'QRCode')
      .map((symbol) => symbol.text);
  } finally {
    queue.release();
  }
}
