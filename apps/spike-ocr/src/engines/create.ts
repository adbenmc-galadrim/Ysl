import { findConfig } from '#/engines/configs';
import { PaddleEngine } from '#/engines/paddle';
import { TesseractEngine } from '#/engines/tesseract';
import type { OcrEngine } from '#/engines/types';

export function createEngine(configId: string, baseUrl: string): OcrEngine {
  const config = findConfig(configId);
  if (config.family === 'tesseract') {
    return new TesseractEngine({ id: config.id, baseUrl });
  }
  return new PaddleEngine({
    id: config.id,
    model: config.model,
    backend: config.backend,
    baseUrl,
  });
}
