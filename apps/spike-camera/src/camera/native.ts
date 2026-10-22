import { readOrientation } from '#/camera/exif';

const EXIF_SEARCH_BYTES = 128 * 1024;

export async function readNative(
  file: File,
): Promise<{ bitmap: ImageBitmap; orientation: number | undefined }> {
  const head = await file.slice(0, EXIF_SEARCH_BYTES).arrayBuffer();
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  return { bitmap, orientation: readOrientation(head) };
}
