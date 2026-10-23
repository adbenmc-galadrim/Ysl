import type { PaddleModelId } from '#/engines/paths';

export type Backend = 'webgpu' | 'wasm';

export type OcrBox = { x: number; y: number; width: number; height: number };

export type OcrLine = { text: string; box: OcrBox; score: number };

export type OcrSource = ImageBitmap | OffscreenCanvas;

export type LoadInfo = {
  fetchMs: number;
  initMs: number;
  modelBytes: number;
  threads: number;
};

export type RecognizeOutput = {
  lines: OcrLine[];
  wasmHeapBytes?: number;
};

export interface OcrEngine {
  readonly id: string;
  readonly backend: Backend;
  load(): Promise<LoadInfo>;
  recognize(source: OcrSource): Promise<RecognizeOutput>;
  dispose(): Promise<void>;
}

export type EngineConfig =
  | {
      id: string;
      label: string;
      family: 'paddle';
      model: PaddleModelId;
      backend: Backend;
    }
  | {
      id: string;
      label: string;
      family: 'tesseract';
      backend: 'wasm';
    };

export class EngineLoadError extends Error {
  constructor(
    readonly backend: Backend,
    message: string,
  ) {
    super(message);
    this.name = 'EngineLoadError';
  }
}
