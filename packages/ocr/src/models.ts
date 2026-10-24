import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import tesseractCoreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';
import paddleDetectionUrl from '../models/paddle/det.onnx?url';
import paddleDictionaryUrl from '../models/paddle/dict.txt?url';
import paddleRecognitionUrl from '../models/paddle/rec.onnx?url';
import type { PaddleAssets } from '#engines/paddle';
import type { TesseractAssets } from '#engines/tesseract';
import { TESSERACT_LANGUAGES_DIR } from '#paths';

export const PADDLE_ASSETS: PaddleAssets = {
  detection: paddleDetectionUrl,
  recognition: paddleRecognitionUrl,
  dictionary: paddleDictionaryUrl,
  wasm: ortWasmUrl,
  mjs: ortMjsUrl,
};

export const tesseractAssets = (base: string): TesseractAssets => ({
  worker: tesseractWorkerUrl,
  core: tesseractCoreUrl,
  languages: new URL(TESSERACT_LANGUAGES_DIR, base).href,
});
