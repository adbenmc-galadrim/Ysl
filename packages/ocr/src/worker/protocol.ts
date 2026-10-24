import type { OcrEngineId, OcrLine } from '#engines/types';

export type { OcrBox, OcrEngineId, OcrLine } from '#engines/types';

export type OcrTimings = { prepMs: number; ocrMs: number };

/** What one photo gave: the lines in the coordinates of the prepared image. */
export type OcrResult = {
  lines: OcrLine[];
  engine: OcrEngineId;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  timings: OcrTimings;
  /** Lower bound of the memory peak: the WASM heaps seen by the Worker. */
  wasmHeapBytes?: number;
};

/** The engine the Worker ended up with, and why it is not Paddle when it is not. */
export type OcrEngineInfo = {
  engine: OcrEngineId;
  threads: number;
  loadMs: number;
  fallbackReason?: string;
};

export type OcrRequest = { type: 'warmup' } | { type: 'recognize'; blob: Blob };

export type WorkerRequest = OcrRequest & { id: number };

export type WorkerResponse =
  | { id: number; ok: true; type: 'warmed'; info: OcrEngineInfo }
  | { id: number; ok: true; type: 'result'; result: OcrResult }
  | { id: number; ok: false; error: string };
