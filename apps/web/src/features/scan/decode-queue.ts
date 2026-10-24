import type {
  BarcodeDecoder,
  DecodeResult,
  WorkerDecodeOptions,
} from '@repo/barcode/worker';

/** A 12 Mpx bitmap weighs ~48 Mo: two in flight is what a burst may hold. */
export const MAX_IN_FLIGHT = 2;

type Decode = (
  bitmap: ImageBitmap,
  options?: WorkerDecodeOptions,
) => Promise<DecodeResult>;

/**
 * Bounds what waits for the Worker: the shutter keeps firing, but a grab
 * beyond the limit waits for the oldest reading to land. A slot covers the
 * whole reading of one shot, second pass included, so the bitmaps alive
 * never exceed the limit; the holder gives it back, success or not.
 */
export class DecodeQueue {
  private inFlight = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    readonly decode: Decode,
    private readonly limit = MAX_IN_FLIGHT,
  ) {}

  get pending(): number {
    return this.inFlight + this.waiting.length;
  }

  /** Resolves once a slot is free: grab the frame after this, not before. */
  acquire(): Promise<void> {
    if (this.inFlight < this.limit) {
      this.inFlight += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.inFlight += 1;
        resolve();
      });
    });
  }

  release(): void {
    this.inFlight -= 1;
    this.waiting.shift()?.();
  }
}

export const queueFor = (decoder: BarcodeDecoder, limit?: number) =>
  new DecodeQueue((bitmap, options) => decoder.decode(bitmap, options), limit);
