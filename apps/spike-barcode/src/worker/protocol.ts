import type { Symbol } from '#/decode/zxing';

export type StepName = 'whole-1600' | 'whole-2400' | 'tiles' | 'maxicode';

export type Step = {
  name: StepName;
  ms: number;
  symbols: number;
  width: number;
  height: number;
};

export type MaxiCodeReport = {
  plain: boolean;
  cropped: boolean | null;
  croppedMs: number | null;
  candidates: number | null;
};

export type DecodeResult = {
  symbols: Symbol[];
  steps: Step[];
  winner: StepName | null;
  maxicode: MaxiCodeReport;
  width: number;
  height: number;
  totalMs: number;
};

export type DecodeOptions = {
  forceMaxiCode: boolean;
  exhaustive: boolean;
};

export type WorkerRequest = {
  id: number;
  bitmap: ImageBitmap;
  options: DecodeOptions;
};

export type WorkerResponse =
  | { id: number; ok: true; result: DecodeResult }
  | { id: number; ok: false; error: string };
