import type { BarcodeDecoder, DecodeResult } from '@repo/barcode/worker';

export async function readFile(
  decoder: BarcodeDecoder,
  file: File,
): Promise<DecodeResult> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    return await decoder.decode(bitmap);
  } catch (error) {
    bitmap.close();
    throw error;
  }
}
