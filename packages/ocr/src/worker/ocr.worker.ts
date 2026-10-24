import { PaddleEngine, wasmThreadCount } from '#engines/paddle';
import { prepare, warmupCanvas } from '#engines/prepare';
import { TesseractEngine } from '#engines/tesseract';
import { errorText, type OcrEngine } from '#engines/types';
import { PADDLE_ASSETS, tesseractAssets } from '#models';
import { installWasmMemoryProbe, wasmHeapBytes } from '#worker/memory';
import { once } from '#worker/once';
import type {
  OcrEngineInfo,
  WorkerRequest,
  WorkerResponse,
} from '#worker/protocol';

installWasmMemoryProbe();

type Loaded = { engine: OcrEngine; info: OcrEngineInfo };

const threads = () =>
  wasmThreadCount(
    globalThis.crossOriginIsolated === true,
    navigator.hardwareConcurrency,
  );

/**
 * Paddle first, as spike S3 decided; Tesseract when Paddle cannot start on
 * this device (session refused, memory, WASM refused). The sessions are
 * warmed by one blank inference so the first photo pays nothing extra.
 */
async function load(): Promise<Loaded> {
  const started = performance.now();
  let fallbackReason: string | undefined;
  const paddle = new PaddleEngine(PADDLE_ASSETS);
  try {
    await paddle.load();
    await paddle.recognize(warmupCanvas());
    return {
      engine: paddle,
      info: {
        engine: 'paddle',
        threads: threads(),
        loadMs: performance.now() - started,
      },
    };
  } catch (error) {
    fallbackReason = errorText(error);
    await paddle.dispose().catch(() => undefined);
  }
  const tesseract = new TesseractEngine(
    tesseractAssets(new URL(__OCR_BASE__, self.location.href).href),
  );
  await tesseract.load();
  await tesseract.recognize(warmupCanvas());
  return {
    engine: tesseract,
    info: {
      engine: 'tesseract',
      threads: 1,
      loadMs: performance.now() - started,
      fallbackReason,
    },
  };
}

const ensure = once(load);

async function handle(request: WorkerRequest): Promise<WorkerResponse> {
  const { id } = request;
  try {
    const { engine, info } = await ensure();
    if (request.type === 'warmup')
      return { id, ok: true, type: 'warmed', info };
    const started = performance.now();
    const prepared = await prepare(request.blob);
    const preparedAt = performance.now();
    const lines = await engine.recognize(prepared.canvas);
    return {
      id,
      ok: true,
      type: 'result',
      result: {
        lines,
        engine: info.engine,
        width: prepared.width,
        height: prepared.height,
        sourceWidth: prepared.sourceWidth,
        sourceHeight: prepared.sourceHeight,
        timings: {
          prepMs: preparedAt - started,
          ocrMs: performance.now() - preparedAt,
        },
        wasmHeapBytes: wasmHeapBytes(),
      },
    };
  } catch (error) {
    return { id, ok: false, error: errorText(error) };
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data).then((response) => postMessage(response));
};
