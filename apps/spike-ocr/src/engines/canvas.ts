import type { OcrSource } from '#/engines/types';

export function toCanvas(source: OcrSource): OffscreenCanvas {
  if (source instanceof OffscreenCanvas) return source;
  const canvas = new OffscreenCanvas(source.width, source.height);
  canvas.getContext('2d')?.drawImage(source, 0, 0);
  return canvas;
}
