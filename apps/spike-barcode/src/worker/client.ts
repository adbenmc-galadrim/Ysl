import type {
  DecodeOptions,
  DecodeResult,
  WorkerResponse,
} from '#/worker/protocol';

type Pending = {
  resolve: (result: DecodeResult) => void;
  reject: (error: Error) => void;
};

export class Decoder {
  private worker: Worker | undefined;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private tail: Promise<unknown> = Promise.resolve();

  decode(bitmap: ImageBitmap, options: DecodeOptions): Promise<DecodeResult> {
    const run = () => this.send(bitmap, options);
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private send(bitmap: ImageBitmap, options: DecodeOptions) {
    const worker = this.ensure();
    const id = this.nextId++;
    return new Promise<DecodeResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, bitmap, options }, [bitmap]);
    });
  }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./decode.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const waiting = this.pending.get(message.id);
      if (!waiting) return;
      this.pending.delete(message.id);
      if (message.ok) waiting.resolve(message.result);
      else waiting.reject(new Error(message.error));
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Worker en erreur');
      for (const waiting of this.pending.values()) waiting.reject(error);
      this.pending.clear();
      worker.terminate();
      this.worker = undefined;
    };
    this.worker = worker;
    return worker;
  }
}
