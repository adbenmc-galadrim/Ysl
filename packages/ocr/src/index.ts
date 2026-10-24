export { linesOf, toLine, type ReadItem } from '#engines/lines';
export {
  MAX_WASM_THREADS,
  PaddleEngine,
  wasmThreadCount,
  type PaddleAssets,
} from '#engines/paddle';
export {
  MAX_SIDE,
  fitWithin,
  prepare,
  warmupCanvas,
  type Prepared,
} from '#engines/prepare';
export { TesseractEngine, type TesseractAssets } from '#engines/tesseract';
export {
  EngineLoadError,
  type OcrBox,
  type OcrEngine,
  type OcrEngineId,
  type OcrLine,
} from '#engines/types';
export { TESSERACT_LANGUAGES, TESSERACT_LANGUAGES_DIR } from '#paths';
export { recipientFromLines } from '#recipient';
