import type {
  OcrEngineId,
  OcrEngineInfo,
  OcrRequest,
  OcrResult,
  WorkerRequest,
  WorkerResponse,
} from '#worker/protocol';

export type WorkerLike = {
  postMessage: (message: WorkerRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

type Pending = {
  resolve: (message: WorkerResponse & { ok: true }) => void;
  reject: (error: Error) => void;
};

/**
 * Longer than any load or reading seen so far (model load 2,4 s and p95
 * 0,8 s per photo on the iPhone, S3), short enough that a Worker stuck
 * before its first answer does not hold the queue for the whole session.
 */
export const DEFAULT_TIMEOUT_MS = 60_000;

export type OcrReaderOptions = {
  /** Past this delay, the reading rejects and the Worker is replaced. */
  timeoutMs?: number;
};

const createDefaultWorker = (): WorkerLike =>
  new Worker(new URL('./ocr.worker.ts', import.meta.url), {
    type: 'module',
  });

/**
 * One photo at a time: each call waits for the previous answer. The Worker
 * is created on the first call and again after it crashed or stayed silent
 * past the timeout; `warmup` loads the engine ahead of the first photo.
 */
export class OcrReader {
  private worker: WorkerLike | undefined;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private epoch = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private info: OcrEngineInfo | undefined;
  private readonly timeoutMs: number;

  constructor(
    private readonly createWorker: () => WorkerLike = createDefaultWorker,
    options: OcrReaderOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** The engine the Worker settled on, once a warm-up or a reading landed. */
  get engine(): OcrEngineId | undefined {
    return this.info?.engine;
  }

  async warmup(): Promise<OcrEngineInfo> {
    const message = await this.enqueue({ type: 'warmup' });
    if (message.type !== 'warmed') throw new Error('Unexpected Worker reply');
    this.info = message.info;
    return message.info;
  }

  async recognize(blob: Blob): Promise<OcrResult> {
    const message = await this.enqueue({ type: 'recognize', blob });
    if (message.type !== 'result') throw new Error('Unexpected Worker reply');
    this.info ??= {
      engine: message.result.engine,
      threads: 0,
      loadMs: 0,
    };
    return message.result;
  }

  dispose() {
    this.epoch++;
    this.worker?.terminate();
    this.worker = undefined;
    this.info = undefined;
    this.rejectAll(new Error('Reader disposed'));
  }

  private enqueue(request: OcrRequest) {
    const epoch = this.epoch;
    const run = () =>
      epoch === this.epoch
        ? this.send(request)
        : Promise.reject(new Error('Reader disposed'));
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private rejectAll(error: Error) {
    for (const waiting of this.pending.values()) waiting.reject(error);
    this.pending.clear();
  }

  private send(request: OcrRequest) {
    const worker = this.ensure();
    const id = this.nextId++;
    return new Promise<WorkerResponse & { ok: true }>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.drop(worker, new Error(`OCR timeout (${this.timeoutMs} ms)`)),
        this.timeoutMs,
      );
      this.pending.set(id, {
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      worker.postMessage({ id, ...request });
    });
  }

  /** A Worker that crashed or stayed silent: everything waiting fails, the next call starts anew. */
  private drop(worker: WorkerLike, error: Error) {
    this.rejectAll(error);
    worker.terminate();
    if (this.worker === worker) {
      this.worker = undefined;
      this.info = undefined;
    }
  }

  private ensure(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => {
      const message = event.data;
      const waiting = this.pending.get(message.id);
      if (!waiting) return;
      this.pending.delete(message.id);
      if (message.ok) waiting.resolve(message);
      else waiting.reject(new Error(message.error));
    };
    worker.onerror = (event) =>
      this.drop(worker, new Error(event.message || 'Worker error'));
    this.worker = worker;
    return worker;
  }
}
