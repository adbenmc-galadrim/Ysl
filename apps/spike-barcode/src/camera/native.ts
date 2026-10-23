export const readNative = (file: File): Promise<ImageBitmap> =>
  createImageBitmap(file, { imageOrientation: 'from-image' });
