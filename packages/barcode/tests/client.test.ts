import { describe, expect, it } from 'vitest';
import { BarcodeDecoder, type WorkerLike } from '#worker/index';
import type {
  DecodeResult,
  WorkerRequest,
  WorkerResponse,
} from '#worker/protocol';

class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  requests: WorkerRequest[] = [];
  transfers: Transferable[][] = [];
  terminated = false;

  postMessage(message: WorkerRequest, transfer: Transferable[]) {
    this.requests.push(message);
    this.transfers.push(transfer);
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

const result = (width: number): DecodeResult => ({
  symbols: [],
  steps: [],
  width,
  height: 1,
  totalMs: 0,
});

const bitmap = () => {
  const closed = { value: false };
  const fake = { close: () => (closed.value = true) };
  return Object.assign(fake as unknown as ImageBitmap, { closed });
};

const setup = () => {
  const workers: FakeWorker[] = [];
  const decoder = new BarcodeDecoder(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { decoder, workers };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('BarcodeDecoder', () => {
  it('sends the second image only after the first answer, transferring the bitmap', async () => {
    const { decoder, workers } = setup();
    const first = bitmap();
    const second = bitmap();
    const a = decoder.decode(first, { thorough: true });
    const b = decoder.decode(second);
    await tick();
    const worker = workers[0]!;
    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0]!.options).toEqual({ thorough: true });
    expect(worker.transfers[0]).toEqual([first]);

    worker.reply({ id: worker.requests[0]!.id, ok: true, result: result(1) });
    await expect(a).resolves.toMatchObject({ width: 1 });
    await tick();
    expect(worker.requests).toHaveLength(2);
    expect(worker.transfers[1]).toEqual([second]);

    worker.reply({ id: worker.requests[1]!.id, ok: true, result: result(2) });
    await expect(b).resolves.toMatchObject({ width: 2 });
  });

  it('forwards the serialisable options to the Worker', async () => {
    const { decoder, workers } = setup();
    void decoder.decode(bitmap(), { thorough: true, expect: ['MaxiCode'] });
    await tick();
    expect(workers[0]!.requests[0]!.options).toEqual({
      thorough: true,
      expect: ['MaxiCode'],
    });
  });

  it('rejects with the worker message when the decode fails', async () => {
    const { decoder, workers } = setup();
    const promise = decoder.decode(bitmap());
    await tick();
    const worker = workers[0]!;
    worker.reply({ id: worker.requests[0]!.id, ok: false, error: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects the waiting decode on a Worker error and starts a new Worker on the next call', async () => {
    const { decoder, workers } = setup();
    const first = decoder.decode(bitmap());
    await tick();
    workers[0]!.fail('crashed');
    await expect(first).rejects.toThrow('crashed');
    expect(workers[0]!.terminated).toBe(true);

    const second = decoder.decode(bitmap());
    await tick();
    expect(workers).toHaveLength(2);
    const worker = workers[1]!;
    worker.reply({ id: worker.requests[0]!.id, ok: true, result: result(3) });
    await expect(second).resolves.toMatchObject({ width: 3 });
  });

  it('terminates the Worker and rejects the waiting decodes on dispose', async () => {
    const { decoder, workers } = setup();
    const first = bitmap();
    const second = bitmap();
    const running = decoder.decode(first);
    const queued = decoder.decode(second);
    await tick();
    decoder.dispose();
    expect(workers[0]!.terminated).toBe(true);
    await expect(running).rejects.toThrow('disposed');
    await expect(queued).rejects.toThrow('disposed');
    expect(workers).toHaveLength(1);
    expect(second.closed.value).toBe(true);
  });
});
