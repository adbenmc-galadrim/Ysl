import * as ort from 'onnxruntime-web';
import {
  PaddleOcrService,
  isWebGpuAvailable,
  type RecognitionResult,
} from 'ppu-paddle-ocr/web';
import { toCanvas } from '#/engines/canvas';
import { wasmThreadCount } from '#/capabilities';
import { wasmHeapBytes } from '#/engines/memory';
import { ORT_DIR, PADDLE_FILES, type PaddleModelId } from '#/engines/paths';
import {
  EngineLoadError,
  type Backend,
  type LoadInfo,
  type OcrEngine,
  type OcrLine,
  type OcrSource,
  type RecognizeOutput,
} from '#/engines/types';

type PaddleEngineOptions = {
  id: string;
  model: PaddleModelId;
  backend: Backend;
  baseUrl: string;
};

async function download(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
  return response.arrayBuffer();
}

function toLine(items: RecognitionResult[]): OcrLine | undefined {
  const first = items[0];
  if (!first) return undefined;
  const left = Math.min(...items.map((item) => item.box.x));
  const top = Math.min(...items.map((item) => item.box.y));
  const right = Math.max(...items.map((item) => item.box.x + item.box.width));
  const bottom = Math.max(...items.map((item) => item.box.y + item.box.height));
  return {
    text: items.map((item) => item.text).join(' '),
    box: { x: left, y: top, width: right - left, height: bottom - top },
    score: items.reduce((sum, item) => sum + item.confidence, 0) / items.length,
  };
}

export class PaddleEngine implements OcrEngine {
  readonly id: string;
  readonly backend: Backend;
  private service: PaddleOcrService | undefined;

  constructor(private readonly options: PaddleEngineOptions) {
    this.id = options.id;
    this.backend = options.backend;
  }

  async load(): Promise<LoadInfo> {
    const { model, backend, baseUrl } = this.options;
    const threads = wasmThreadCount(
      globalThis.crossOriginIsolated,
      navigator.hardwareConcurrency,
    );
    ort.env.wasm.wasmPaths = new URL(ORT_DIR, baseUrl).href;
    ort.env.wasm.numThreads = threads;
    if (backend === 'webgpu' && !(await isWebGpuAvailable())) {
      throw new EngineLoadError(
        'webgpu',
        'WebGPU indisponible dans le worker (navigator.gpu absent ou sans adaptateur)',
      );
    }
    const files = PADDLE_FILES[model];
    const started = performance.now();
    const [detection, recognition, charactersDictionary] = await Promise.all([
      download(new URL(files.detection, baseUrl).href),
      download(new URL(files.recognition, baseUrl).href),
      download(new URL(files.dictionary, baseUrl).href),
    ]);
    const fetched = performance.now();
    const modelBytes = detection.byteLength + recognition.byteLength;

    let fallback: unknown;
    const service = new PaddleOcrService({
      model: { detection, recognition, charactersDictionary },
      session: {
        executionProviders: [backend],
        graphOptimizationLevel: 'all',
        onSessionFallback: (error) => {
          fallback ??= error;
        },
      },
    });
    try {
      await service.initialize();
    } catch (error) {
      await service.destroy().catch(() => undefined);
      throw new EngineLoadError(backend, errorText(error));
    }
    if (fallback !== undefined) {
      await service.destroy().catch(() => undefined);
      throw new EngineLoadError(
        backend,
        `session ${backend} refusée par onnxruntime-web : ${errorText(fallback)}`,
      );
    }
    this.service = service;
    return {
      fetchMs: fetched - started,
      initMs: performance.now() - fetched,
      modelBytes,
      threads,
    };
  }

  async recognize(source: OcrSource): Promise<RecognizeOutput> {
    if (!this.service) throw new Error('moteur non chargé');
    const canvas = toCanvas(source);
    const result = await this.service.recognize(canvas);
    const lines = result.lines.flatMap((items) => toLine(items) ?? []);
    return { lines, wasmHeapBytes: wasmHeapBytes() };
  }

  async dispose(): Promise<void> {
    await this.service?.destroy();
    this.service = undefined;
  }
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}
