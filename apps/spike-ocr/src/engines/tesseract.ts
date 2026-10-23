import { createWorker, OEM, type Worker } from 'tesseract.js';
import { toCanvas } from '#/engines/canvas';
import {
  TESSERACT_CORE_DIR,
  TESSERACT_LANG_DIR,
  TESSERACT_LANGS,
  TESSERACT_WORKER,
} from '#/engines/paths';
import type {
  Backend,
  LoadInfo,
  OcrEngine,
  OcrLine,
  OcrSource,
  RecognizeOutput,
} from '#/engines/types';

type TesseractEngineOptions = { id: string; baseUrl: string };

type ProbedPage = { wasmHeapBytes?: number };

export class TesseractEngine implements OcrEngine {
  readonly id: string;
  readonly backend: Backend = 'wasm';
  private worker: Worker | undefined;

  constructor(private readonly options: TesseractEngineOptions) {
    this.id = options.id;
  }

  async load(): Promise<LoadInfo> {
    const { baseUrl } = this.options;
    const started = performance.now();
    this.worker = await createWorker([...TESSERACT_LANGS], OEM.LSTM_ONLY, {
      workerPath: new URL(TESSERACT_WORKER, baseUrl).href,
      corePath: new URL(`${TESSERACT_CORE_DIR}/`, baseUrl).href,
      langPath: new URL(`${TESSERACT_LANG_DIR}/`, baseUrl).href,
      gzip: false,
      cacheMethod: 'none',
      workerBlobURL: false,
    });
    const sizes = await Promise.all(
      TESSERACT_LANGS.map(async (lang) => {
        const response = await fetch(
          new URL(`${TESSERACT_LANG_DIR}/${lang}.traineddata`, baseUrl),
          { method: 'HEAD' },
        );
        return Number(response.headers.get('content-length') ?? 0);
      }),
    );
    return {
      fetchMs: 0,
      initMs: performance.now() - started,
      modelBytes: sizes.reduce((sum, size) => sum + size, 0),
      threads: 1,
    };
  }

  async recognize(source: OcrSource): Promise<RecognizeOutput> {
    if (!this.worker) throw new Error('moteur non chargé');
    const canvas = toCanvas(source);
    const { data } = await this.worker.recognize(canvas, {}, { blocks: true });
    const lines: OcrLine[] = (data.blocks ?? [])
      .flatMap((block) => block.paragraphs)
      .flatMap((paragraph) => paragraph.lines)
      .map((line) => ({
        text: line.text.trim(),
        box: {
          x: line.bbox.x0,
          y: line.bbox.y0,
          width: line.bbox.x1 - line.bbox.x0,
          height: line.bbox.y1 - line.bbox.y0,
        },
        score: line.confidence / 100,
      }))
      .filter((line) => line.text !== '');
    return {
      lines,
      wasmHeapBytes: (data as ProbedPage).wasmHeapBytes,
    };
  }

  async dispose(): Promise<void> {
    await this.worker?.terminate();
    this.worker = undefined;
  }
}
