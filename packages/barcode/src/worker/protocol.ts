import type { DecodeResult } from '#cascade';
import type { ReadableFormat } from '#zxing';

export type { DecodeResult, Step, StepName } from '#cascade';

/**
 * Serialisable form of `DecodeOptions`: `expect` lists the formats that end
 * the cascade once they are all read, the only `enough` a Worker can carry.
 */
export type WorkerDecodeOptions = {
  thorough?: boolean;
  expect?: readonly ReadableFormat[];
};

export type WorkerRequest = {
  id: number;
  bitmap: ImageBitmap;
  options: WorkerDecodeOptions;
};

export type WorkerResponse =
  | { id: number; ok: true; result: DecodeResult }
  | { id: number; ok: false; error: string };
