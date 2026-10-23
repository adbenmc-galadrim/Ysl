export type CaptureMode = 'grabFrame' | 'video' | 'native';

export type Shot = {
  photo: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
};

type ImageCaptureLike = { grabFrame(): Promise<ImageBitmap> };
type ImageCaptureConstructor = new (
  track: MediaStreamTrack,
) => ImageCaptureLike;

const MAX_PIXELS = 16_000_000;
const THUMBNAIL_SIDE = 200;
const JPEG_QUALITY = 0.9;

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

export async function grab(
  video: HTMLVideoElement,
  track: MediaStreamTrack | undefined,
  onGrabFrameError: (error: unknown) => void,
): Promise<{ bitmap: ImageBitmap; mode: CaptureMode }> {
  const capture = track && imageCaptureFor(track);
  if (capture) {
    try {
      return { bitmap: await capture.grabFrame(), mode: 'grabFrame' };
    } catch (error) {
      onGrabFrameError(error);
    }
  }
  return { bitmap: await createImageBitmap(video), mode: 'video' };
}

export function fitPixels(
  width: number,
  height: number,
  maxPixels: number,
): { width: number; height: number } {
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
  };
}

async function draw(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponible');
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

export async function shoot(bitmap: ImageBitmap): Promise<Shot> {
  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const { width, height } = fitPixels(sourceWidth, sourceHeight, MAX_PIXELS);
    const photo = await draw(bitmap, width, height, JPEG_QUALITY);
    const scale = THUMBNAIL_SIDE / Math.max(width, height);
    const thumbnail = await draw(
      bitmap,
      Math.round(width * scale),
      Math.round(height * scale),
      0.7,
    );
    return { photo, thumbnail, width, height, sourceWidth, sourceHeight };
  } finally {
    bitmap.close();
  }
}
