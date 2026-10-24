import { createWorker, OEM, type Worker } from 'tesseract.js';
import {
  EngineLoadError,
  errorText,
  type OcrEngine,
  type OcrLine,
} from '#engines/types';
import { TESSERACT_LANGUAGES } from '#paths';

export type TesseractAssets = {
  /** `tesseract.js/dist/worker.min.js`, a classic worker script. */
  worker: string;
  /** One `tesseract-core-*.wasm.js` file, which embeds its own `.wasm`. */
  core: string;
  /** Directory URL holding `fra.traineddata` and `eng.traineddata`, no gzip. */
  languages: string;
};

/** Tesseract.js v7 (tessdata_fast, LSTM only): the fallback behind the same interface. */
export class TesseractEngine implements OcrEngine {
  readonly id = 'tesseract';
  private worker: Worker | undefined;

  constructor(private readonly assets: TesseractAssets) {}

  async load(): Promise<void> {
    try {
      this.worker = await createWorker(
        [...TESSERACT_LANGUAGES],
        OEM.LSTM_ONLY,
        {
          workerPath: this.assets.worker,
          corePath: this.assets.core,
          langPath: this.assets.languages,
          gzip: false,
          cacheMethod: 'none',
          workerBlobURL: false,
        },
      );
    } catch (error) {
      throw new EngineLoadError('tesseract', errorText(error));
    }
  }

  async recognize(canvas: OffscreenCanvas): Promise<OcrLine[]> {
    if (!this.worker) throw new Error('Engine not loaded');
    const { data } = await this.worker.recognize(canvas, {}, { blocks: true });
    return (data.blocks ?? [])
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
  }

  async dispose(): Promise<void> {
    await this.worker?.terminate();
    this.worker = undefined;
  }
}
