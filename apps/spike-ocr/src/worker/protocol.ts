import type { LoadInfo, OcrLine } from '#/engines/types';
import type { Backend } from '#/engines/types';

export type WorkerRequest =
  | { rid: number; type: 'load'; configId: string; baseUrl: string }
  | { rid: number; type: 'warmup' }
  | { rid: number; type: 'recognize'; blob: Blob }
  | { rid: number; type: 'dispose' };

export type RecognizeTimings = {
  prepMs: number;
  ocrMs: number;
  totalMs: number;
};

export type WorkerResponse =
  | { rid: number; type: 'loaded'; info: LoadInfo; loadMs: number }
  | { rid: number; type: 'load-failed'; backend: Backend; error: string }
  | { rid: number; type: 'warmed'; ms: number }
  | {
      rid: number;
      type: 'result';
      lines: OcrLine[];
      timings: RecognizeTimings;
      width: number;
      height: number;
      sourceWidth: number;
      sourceHeight: number;
      wasmHeapBytes?: number;
      jsHeapBytes?: number;
    }
  | { rid: number; type: 'failed'; error: string }
  | { rid: number; type: 'disposed' };
