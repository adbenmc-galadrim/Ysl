import { PADDLE_ASSETS, tesseractAssets } from '#models';
import { TESSERACT_LANGUAGES, languageFile } from '#paths';

/**
 * The reader's heavy files, absolute: the ONNX models, the onnxruntime
 * binary, the Tesseract core and languages. The app downloads them into its
 * models cache with a progress bar and the service worker serves them from
 * there; the small ones (dictionary, thread glue, Tesseract worker) stay in
 * the precache.
 */
export function readerAssetUrls(base: string): string[] {
  const tesseract = tesseractAssets(base);
  return [
    PADDLE_ASSETS.detection,
    PADDLE_ASSETS.recognition,
    PADDLE_ASSETS.wasm,
    tesseract.core,
    ...TESSERACT_LANGUAGES.map(
      (language) => `${tesseract.languages}/${languageFile(language)}`,
    ),
  ].map((url) => new URL(url, base).href);
}
