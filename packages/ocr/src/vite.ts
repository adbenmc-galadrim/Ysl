import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { defaultClientConditions, type Connect, type Plugin } from 'vite';
import {
  TESSERACT_LANGUAGES,
  TESSERACT_LANGUAGES_DIR,
  languageFile,
} from '#paths';

const ISOLATION = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// Set by middleware: `preview.headers` skips 304 responses, and WebKit then
// refuses to start a second Worker.
const setIsolation: Connect.NextHandleFunction = (_request, response, next) => {
  for (const [name, value] of Object.entries(ISOLATION)) {
    response.setHeader(name, value);
  }
  next();
};

const modelsDir = resolve(import.meta.dirname, '..', 'models', 'tesseract');

const withSlash = (base = '/') => (base.endsWith('/') ? base : `${base}/`);

const serveLanguages = (base: string): Connect.NextHandleFunction => {
  const prefix = `${base}${TESSERACT_LANGUAGES_DIR}/`;
  return (request, response, next) => {
    const url = request.url?.split('?')[0] ?? '';
    const language = TESSERACT_LANGUAGES.find(
      (code) => url === prefix + languageFile(code),
    );
    if (!language) return next();
    readFile(join(modelsDir, languageFile(language))).then(
      (data) => {
        response.setHeader('Content-Type', 'application/octet-stream');
        response.end(data);
      },
      () => {
        response.statusCode = 404;
        response.end(
          `${languageFile(language)}: run pnpm --filter @repo/ocr models`,
        );
      },
    );
  };
};

/**
 * Everything the app's Vite config needs for `@repo/ocr`:
 * - `onnxruntime-web` resolved to its CPU-only build (14 Mo of WASM instead
 *   of the 28 Mo WebGPU one; S3 ruled WebGPU out), with its `.mjs` glue kept
 *   as a separate file: bundled into the OCR Worker, the thread Workers would
 *   reload the whole OCR Worker instead and never answer;
 * - COOP/COEP in dev and preview, for the WASM threads;
 * - the Tesseract languages published under a stable path, since
 *   tesseract.js composes `<dir>/<lang>.traineddata` itself; the Worker learns
 *   the app's base through the `__OCR_BASE__` constant.
 */
export const ocrVite = (): Plugin => {
  let base = '/';
  let published = false;
  return {
    name: 'ocr',
    config: (userConfig) => ({
      define: { __OCR_BASE__: JSON.stringify(withSlash(userConfig.base)) },
      resolve: {
        alias: [
          { find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/wasm' },
        ],
        conditions: [
          ...defaultClientConditions,
          'onnxruntime-web-use-extern-wasm',
        ],
      },
      optimizeDeps: { exclude: ['@repo/ocr', 'onnxruntime-web'] },
    }),
    configResolved: (config) => {
      base = config.base;
    },
    configureServer: (server) => {
      server.middlewares.use(setIsolation);
      server.middlewares.use(serveLanguages(base));
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(setIsolation);
    },
    buildStart: () => {
      published = false;
    },
    generateBundle: async function () {
      if (published) return;
      published = true;
      for (const language of TESSERACT_LANGUAGES) {
        this.emitFile({
          type: 'asset',
          fileName: `${TESSERACT_LANGUAGES_DIR}/${languageFile(language)}`,
          source: await readFile(join(modelsDir, languageFile(language))),
        });
      }
    },
  };
};
