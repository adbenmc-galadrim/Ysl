import { readJpegInfo, type JpegInfo } from '#/camera/exif';

const HEADER_BYTES = 256 * 1024;

export async function readNative(
  file: File,
): Promise<{ bitmap: ImageBitmap; info: JpegInfo }> {
  const head = await file.slice(0, HEADER_BYTES).arrayBuffer();
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  return { bitmap, info: readJpegInfo(head) };
}
