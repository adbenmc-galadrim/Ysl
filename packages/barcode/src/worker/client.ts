import type {
  DecodeResult,
  WorkerDecodeOptions,
  WorkerRequest,
  WorkerResponse,
} from '#worker/protocol';

export type WorkerLike = {
  postMessage: (message: WorkerRequest, transfer: Transferable[]) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

type Pending = {
  resolve: (result: DecodeResult) => void;
  reject: (error: Error) => void;
};

const createDefaultWorker = (): WorkerLike =>
  new Worker(new URL('./decode.worker.ts', import.meta.url), {
    type: 'module',
  });

export class BarcodeDecoder {
  private worker: WorkerLike | undefined;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private epoch = 0;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly createWorker: () => WorkerLike = createDefaultWorker,
  ) {}

  decode(
    bitmap: ImageBitmap,
    options: WorkerDecodeOptions = {},
  ): Promise<DecodeResult> {
    const epoch = this.epoch;
    const run = () => {
      if (epoch === this.epoch) return this.send(bitmap, options);
      bitmap.close();
      return Promise.reject(new Error('Decoder disposed'));
    };
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  dispose() {
    this.epoch++;
    this.worker?.terminate();
    this.worker = undefined;
    this.rejectAll(new Error('Decoder disposed'));
  }

  private rejectAll(error: Error) {
    for (const waiting of this.pending.values()) waiting.reject(error);
    this.pending.clear();
  }

  private send(bitmap: ImageBitmap, options: WorkerDecodeOptions) {
    const worker = this.ensure();
    const id = this.nextId++;
    return new Promise<DecodeResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, bitmap, options }, [bitmap]);
    });
  }

  private ensure(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => {
      const message = event.data;
      const waiting = this.pending.get(message.id);
      if (!waiting) return;
      this.pending.delete(message.id);
      if (message.ok) waiting.resolve(message.result);
      else waiting.reject(new Error(message.error));
    };
    worker.onerror = (event) => {
      this.rejectAll(new Error(event.message || 'Worker error'));
      worker.terminate();
      if (this.worker === worker) this.worker = undefined;
    };
    this.worker = worker;
    return worker;
  }
}
