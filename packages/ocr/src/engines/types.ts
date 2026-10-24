export type OcrBox = { x: number; y: number; width: number; height: number };

/** One line of text as the engine read it, in the coordinates of the prepared image. */
export type OcrLine = { text: string; box: OcrBox; score: number };

export type OcrEngineId = 'paddle' | 'tesseract';

export interface OcrEngine {
  readonly id: OcrEngineId;
  load(): Promise<void>;
  recognize(canvas: OffscreenCanvas): Promise<OcrLine[]>;
  dispose(): Promise<void>;
}

export class EngineLoadError extends Error {
  constructor(
    readonly engine: OcrEngineId,
    message: string,
  ) {
    super(message);
    this.name = 'EngineLoadError';
  }
}

export const errorText = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);
