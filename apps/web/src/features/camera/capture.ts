type ImageCaptureLike = { grabFrame(): Promise<ImageBitmap> };
type ImageCaptureConstructor = new (
  track: MediaStreamTrack,
) => ImageCaptureLike;

/** Stored labels: JPEG on the long side of 1 600 px, quality 0.8 (§6.6). */
export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.8;

const imageCaptures = new WeakMap<MediaStreamTrack, ImageCaptureLike>();

function imageCaptureFor(
  track: MediaStreamTrack,
): ImageCaptureLike | undefined {
  const ImageCapture = (
    globalThis as { ImageCapture?: ImageCaptureConstructor }
  ).ImageCapture;
  if (!ImageCapture) return undefined;
  let capture = imageCaptures.get(track);
  if (!capture) {
    capture = new ImageCapture(track);
    imageCaptures.set(track, capture);
  }
  return capture;
}

/**
 * A full-resolution frame of the stream (S1: `grabFrame` gives the 12 Mpx
 * of the sensor), or the displayed frame when the API is missing.
 */
export async function grabFrame(
  video: HTMLVideoElement,
  track: MediaStreamTrack | undefined,
): Promise<ImageBitmap> {
  const capture = track && imageCaptureFor(track);
  if (capture) {
    try {
      return await capture.grabFrame();
    } catch {
      // The track was interrupted mid-grab: the video frame will do.
    }
  }
  return createImageBitmap(video);
}

/** Shrinks to fit the long side, never enlarges, keeps the ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type EncodedPhoto = { blob: Blob; width: number; height: number };

/** The JPEG kept on the device; the bitmap is left open for the caller. */
export async function encodePhoto(
  bitmap: ImageBitmap,
  maxSide = PHOTO_MAX_SIDE,
  quality = PHOTO_QUALITY,
): Promise<EncodedPhoto> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return { blob, width, height };
}
