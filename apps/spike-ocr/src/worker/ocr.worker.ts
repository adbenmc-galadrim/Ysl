import { installWasmMemoryProbe } from '#/engines/memory';
import { createEngine } from '#/engines/create';
import { prepare, warmupCanvas } from '#/engines/prepare';
import { EngineLoadError, type OcrEngine } from '#/engines/types';
import type { WorkerRequest, WorkerResponse } from '#/worker/protocol';

installWasmMemoryProbe();

type Scope = {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

const scope = self as unknown as Scope;
let engine: OcrEngine | undefined;
let configId = '';

function errorText(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

function jsHeapBytes(): number | undefined {
  return (performance as Performance & { memory?: { usedJSHeapSize: number } })
    .memory?.usedJSHeapSize;
}

async function handle(request: WorkerRequest): Promise<WorkerResponse> {
  const { rid } = request;
  switch (request.type) {
    case 'load': {
      await engine?.dispose();
      engine = undefined;
      configId = request.configId;
      const started = performance.now();
      try {
        const created = createEngine(request.configId, request.baseUrl);
        const info = await created.load();
        engine = created;
        return {
          rid,
          type: 'loaded',
          info,
          loadMs: performance.now() - started,
        };
      } catch (error) {
        const backend =
          error instanceof EngineLoadError
            ? error.backend
            : configId.endsWith('webgpu')
              ? 'webgpu'
              : 'wasm';
        return { rid, type: 'load-failed', backend, error: errorText(error) };
      }
    }
    case 'warmup': {
      if (!engine) return { rid, type: 'failed', error: 'moteur non chargé' };
      const started = performance.now();
      try {
        await engine.recognize(warmupCanvas());
        return { rid, type: 'warmed', ms: performance.now() - started };
      } catch (error) {
        return { rid, type: 'failed', error: errorText(error) };
      }
    }
    case 'recognize': {
      if (!engine) return { rid, type: 'failed', error: 'moteur non chargé' };
      try {
        const started = performance.now();
        const prepared = await prepare(request.blob);
        const preparedAt = performance.now();
        const output = await engine.recognize(prepared.canvas);
        const finished = performance.now();
        return {
          rid,
          type: 'result',
          lines: output.lines,
          timings: {
            prepMs: preparedAt - started,
            ocrMs: finished - preparedAt,
            totalMs: finished - started,
          },
          width: prepared.width,
          height: prepared.height,
          sourceWidth: prepared.sourceWidth,
          sourceHeight: prepared.sourceHeight,
          wasmHeapBytes: output.wasmHeapBytes,
          jsHeapBytes: jsHeapBytes(),
        };
      } catch (error) {
        return { rid, type: 'failed', error: errorText(error) };
      }
    }
    case 'dispose': {
      await engine?.dispose();
      engine = undefined;
      return { rid, type: 'disposed' };
    }
  }
}

scope.onmessage = (event) => {
  void handle(event.data).then((response) => scope.postMessage(response));
};
