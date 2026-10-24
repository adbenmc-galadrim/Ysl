import * as ort from 'onnxruntime-web';
import { PaddleOcrService } from 'ppu-paddle-ocr/web';
import { linesOf } from '#engines/lines';
import {
  EngineLoadError,
  errorText,
  type OcrEngine,
  type OcrLine,
} from '#engines/types';

/** Measured in spike S3: beyond four threads the iPhone gains nothing. */
export const MAX_WASM_THREADS = 4;

/** Threads only exist behind COOP/COEP; elsewhere the runtime stays single-threaded. */
export function wasmThreadCount(
  isolated: boolean,
  hardwareConcurrency: number,
): number {
  if (!isolated) return 1;
  return Math.max(1, Math.min(MAX_WASM_THREADS, hardwareConcurrency || 1));
}

export type PaddleAssets = {
  detection: string;
  recognition: string;
  dictionary: string;
  /** The CPU-only `ort-wasm-simd-threaded.wasm` of onnxruntime-web. */
  wasm: string;
  /**
   * Its `.mjs` glue, served as a file: the threads are Workers that load
   * this script by URL, so it cannot live inside the bundle of the OCR Worker.
   */
  mjs: string;
};

async function download(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

/** PP-OCRv6 tiny on the WASM execution provider, the configuration kept by S3. */
export class PaddleEngine implements OcrEngine {
  readonly id = 'paddle';
  private service: PaddleOcrService | undefined;

  constructor(private readonly assets: PaddleAssets) {}

  async load(): Promise<void> {
    ort.env.wasm.wasmPaths = { wasm: this.assets.wasm, mjs: this.assets.mjs };
    ort.env.wasm.numThreads = wasmThreadCount(
      globalThis.crossOriginIsolated === true,
      navigator.hardwareConcurrency,
    );
    let fallback: unknown;
    let service: PaddleOcrService;
    try {
      const [detection, recognition, charactersDictionary] = await Promise.all([
        download(this.assets.detection),
        download(this.assets.recognition),
        download(this.assets.dictionary),
      ]);
      service = new PaddleOcrService({
        model: { detection, recognition, charactersDictionary },
        session: {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          onSessionFallback: (error) => {
            fallback ??= error;
          },
        },
      });
      await service.initialize();
    } catch (error) {
      throw new EngineLoadError('paddle', errorText(error));
    }
    if (fallback !== undefined) {
      await service.destroy().catch(() => undefined);
      throw new EngineLoadError(
        'paddle',
        `wasm session refused by onnxruntime-web: ${errorText(fallback)}`,
      );
    }
    this.service = service;
  }

  async recognize(canvas: OffscreenCanvas): Promise<OcrLine[]> {
    if (!this.service) throw new Error('Engine not loaded');
    const result = await this.service.recognize(canvas);
    return linesOf(result.lines);
  }

  async dispose(): Promise<void> {
    await this.service?.destroy();
    this.service = undefined;
  }
}
