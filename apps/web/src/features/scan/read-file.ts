import { fitWithin } from '#/features/camera/capture';

/**
 * A photo from the library or the native camera is brought down to the long
 * side of the viewfinder's stream (S1: 4 032 px): a 48 Mpx picture would
 * weigh ~190 Mo as a bitmap, four times what a burst frame does, and the
 * reader was sized for the stream.
 */
export const IMPORT_MAX_SIDE = 4032;

/**
 * The picture as the reader takes it: upright (EXIF orientation applied,
 * which a native photo always carries) and no larger than the stream. The
 * full-size bitmap is closed as soon as a smaller one replaces it.
 */
export async function readImageFile(
  file: Blob,
  maxSide = IMPORT_MAX_SIDE,
): Promise<ImageBitmap> {
  const full = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  const { width, height } = fitWithin(full.width, full.height, maxSide);
  if (width === full.width && height === full.height) return full;
  try {
    return await createImageBitmap(full, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    });
  } finally {
    full.close();
  }
}
