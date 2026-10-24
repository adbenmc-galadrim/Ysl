import { afterEach, describe, expect, it, vi } from 'vitest';
import { OcrReader, type WorkerLike } from '#worker/index';
import type {
  OcrResult,
  WorkerRequest,
  WorkerResponse,
} from '#worker/protocol';

class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  requests: WorkerRequest[] = [];
  terminated = false;

  postMessage(message: WorkerRequest) {
    this.requests.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  reply(message: WorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }

  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const result = (width: number): OcrResult => ({
  lines: [],
  engine: 'paddle',
  width,
  height: 1,
  sourceWidth: width,
  sourceHeight: 1,
  timings: { prepMs: 0, ocrMs: 0 },
});

const blob = () => new Blob(['x']);

const setup = () => {
  const workers: FakeWorker[] = [];
  const reader = new OcrReader(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { reader, workers };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('OcrReader', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the second photo only after the first answer', async () => {
    const { reader, workers } = setup();
    const a = reader.recognize(blob());
    const b = reader.recognize(blob());
    await tick();
    const worker = workers[0]!;
    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0]).toMatchObject({ type: 'recognize' });

    worker.reply({
      id: worker.requests[0]!.id,
      ok: true,
      type: 'result',
      result: result(1),
    });
    await expect(a).resolves.toMatchObject({ width: 1 });
    await tick();
    expect(worker.requests).toHaveLength(2);

    worker.reply({
      id: worker.requests[1]!.id,
      ok: true,
      type: 'result',
      result: result(2),
    });
    await expect(b).resolves.toMatchObject({ width: 2 });
  });

  it('tells which engine the Worker settled on after the warm-up', async () => {
    const { reader, workers } = setup();
    expect(reader.engine).toBeUndefined();
    const warm = reader.warmup();
    await tick();
    const worker = workers[0]!;
    expect(worker.requests[0]).toMatchObject({ type: 'warmup' });
    worker.reply({
      id: worker.requests[0]!.id,
      ok: true,
      type: 'warmed',
      info: {
        engine: 'tesseract',
        threads: 1,
        loadMs: 12,
        fallbackReason: 'wasm session refused',
      },
    });
    await expect(warm).resolves.toMatchObject({
      engine: 'tesseract',
      fallbackReason: 'wasm session refused',
    });
    expect(reader.engine).toBe('tesseract');
  });

  it('rejects with the Worker message when a reading fails', async () => {
    const { reader, workers } = setup();
    const promise = reader.recognize(blob());
    await tick();
    const worker = workers[0]!;
    worker.reply({ id: worker.requests[0]!.id, ok: false, error: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects the waiting reading on a Worker error and starts a new Worker next', async () => {
    const { reader, workers } = setup();
    const first = reader.recognize(blob());
    await tick();
    workers[0]!.fail('crashed');
    await expect(first).rejects.toThrow('crashed');
    expect(workers[0]!.terminated).toBe(true);
    expect(reader.engine).toBeUndefined();

    const second = reader.recognize(blob());
    await tick();
    expect(workers).toHaveLength(2);
    const worker = workers[1]!;
    worker.reply({
      id: worker.requests[0]!.id,
      ok: true,
      type: 'result',
      result: result(3),
    });
    await expect(second).resolves.toMatchObject({ width: 3 });
    expect(reader.engine).toBe('paddle');
  });

  it('gives up on a Worker silent past the timeout and starts a new one next', async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const reader = new OcrReader(
      () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      { timeoutMs: 1000 },
    );
    const stuck = reader.recognize(blob());
    const rejected = expect(stuck).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(999);
    expect(workers[0]!.terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(workers[0]!.terminated).toBe(true);

    const next = reader.recognize(blob());
    await vi.advanceTimersByTimeAsync(0);
    expect(workers).toHaveLength(2);
    const worker = workers[1]!;
    worker.reply({
      id: worker.requests[0]!.id,
      ok: true,
      type: 'result',
      result: result(4),
    });
    await expect(next).resolves.toMatchObject({ width: 4 });
  });

  it('terminates the Worker and rejects the waiting readings on dispose', async () => {
    const { reader, workers } = setup();
    const running = reader.recognize(blob());
    const queued = reader.recognize(blob());
    await tick();
    reader.dispose();
    expect(workers[0]!.terminated).toBe(true);
    await expect(running).rejects.toThrow('disposed');
    await expect(queued).rejects.toThrow('disposed');
    expect(workers).toHaveLength(1);
  });
});
