import type { OcrLine } from '#/engines/types';
import type {
  RecognizeTimings,
  WorkerRequest,
  WorkerResponse,
} from '#/worker/protocol';

type Pending = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
};

export type RecognizeResult = {
  lines: OcrLine[];
  timings: RecognizeTimings;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  wasmHeapBytes?: number;
  jsHeapBytes?: number;
};

type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

export class OcrClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private counter = 0;

  constructor(private readonly baseUrl: string) {
    this.worker = new Worker(new URL('./ocr.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const waiting = this.pending.get(event.data.rid);
      this.pending.delete(event.data.rid);
      waiting?.resolve(event.data);
    };
    const fail = (message: string) => {
      for (const waiting of this.pending.values()) {
        waiting.reject(new Error(message));
      }
      this.pending.clear();
    };
    this.worker.onerror = (event) =>
      fail(`erreur du worker : ${event.message || 'inconnue'}`);
    this.worker.onmessageerror = () => fail('message du worker illisible');
  }

  private call(
    request: DistributiveOmit<WorkerRequest, 'rid'>,
  ): Promise<WorkerResponse> {
    this.counter += 1;
    const rid = this.counter;
    return new Promise((resolve, reject) => {
      this.pending.set(rid, { resolve, reject });
      this.worker.postMessage({ ...request, rid });
    });
  }

  load(configId: string) {
    return this.call({ type: 'load', configId, baseUrl: this.baseUrl });
  }

  warmup() {
    return this.call({ type: 'warmup' });
  }

  async recognize(blob: Blob): Promise<RecognizeResult> {
    const response = await this.call({ type: 'recognize', blob });
    if (response.type === 'result') return response;
    throw new Error(
      response.type === 'failed' ? response.error : 'réponse inattendue',
    );
  }

  async dispose(): Promise<void> {
    await this.call({ type: 'dispose' });
  }

  terminate(): void {
    this.worker.terminate();
    for (const waiting of this.pending.values()) {
      waiting.reject(new Error('worker arrêté'));
    }
    this.pending.clear();
  }
}
