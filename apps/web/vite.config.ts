import { resolve } from 'node:path';
import { withoutCdn } from '@repo/barcode/vite';
import { ocrVite } from '@repo/ocr/vite';
import { SERVER_PORT, WEB_PORT } from '@repo/shared/env/ports';
import { DEFAULT_LOCALE } from '@repo/shared/i18n';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const VERSION = new Date().toISOString();

/** Kept out of the precache: the app fetches them itself (`features/offline`). */
const READER_FILES = [
  '**/*.onnx',
  '**/*.traineddata',
  '**/ort-wasm-simd-threaded*.wasm',
  '**/tesseract-core-*.js',
];
const READER_FILE_PATTERN =
  /\.(onnx|traineddata)$|\/ort-wasm-simd-threaded[^/]*\.wasm$|\/tesseract-core-[^/]*\.js$/;
const MODELS_CACHE = 'courrier-models';

function versionFile(): Plugin {
  const source = JSON.stringify({ version: VERSION, builtAt: VERSION });
  return {
    name: 'version-file',
    configureServer(server) {
      server.middlewares.use('/version.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source });
    },
  };
}

function htmlWording(appName: string): Plugin {
  return {
    name: 'html-wording',
    transformIndexHtml: (html) => ({
      html: html.replace('<html>', `<html lang="${DEFAULT_LOCALE}">`),
      tags: [
        {
          tag: 'title',
          attrs: { 'data-boot-title': '' },
          children: appName,
          injectTo: 'head-prepend',
        },
        {
          tag: 'meta',
          attrs: { name: 'apple-mobile-web-app-title', content: appName },
          injectTo: 'head',
        },
      ],
    }),
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const appName =
    process.env.PUBLIC_APP_NAME || (isProduction ? undefined : 'Courrier');
  const serverUrl =
    process.env.PUBLIC_SERVER_URL ||
    (isProduction ? undefined : `http://localhost:${SERVER_PORT}`);
  const appUrl =
    process.env.PUBLIC_APP_URL ||
    (isProduction ? undefined : `http://localhost:${WEB_PORT}`);
  if (!appName || !serverUrl || !appUrl) {
    throw new Error(
      'PUBLIC_APP_NAME, PUBLIC_SERVER_URL and PUBLIC_APP_URL are required for a production build.',
    );
  }

  return {
    envDir: resolve(import.meta.dirname, '../..'),
    envPrefix: 'PUBLIC_',
    server: { port: WEB_PORT, strictPort: true },
    preview: { port: WEB_PORT, strictPort: true },
    define: {
      'import.meta.env.PUBLIC_APP_NAME': JSON.stringify(appName),
      'import.meta.env.PUBLIC_SERVER_URL': JSON.stringify(serverUrl),
      'import.meta.env.PUBLIC_APP_URL': JSON.stringify(appUrl),
      __APP_VERSION__: JSON.stringify(VERSION),
    },
    optimizeDeps: {
      exclude: ['@repo/barcode', '@repo/shared'],
    },
    worker: { format: 'es', plugins: () => [withoutCdn()] },
    resolve: { tsconfigPaths: true },
    plugins: [
      htmlWording(appName),
      tailwindcss(),
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: './src/app/routes',
        generatedRouteTree: './src/app/routeTree.gen.ts',
      }),
      viteReact(),
      versionFile(),
      ocrVite(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: appName,
          short_name: appName,
          lang: DEFAULT_LOCALE,
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },
        workbox: {
          globPatterns: [
            '**/*.{js,mjs,css,html,svg,png,webmanifest,woff2,wasm,txt}',
          ],
          // The reader's heavy files are not precached: the app downloads
          // them into `courrier-models` with a progress bar (YSL-35).
          globIgnores: ['version.json', ...READER_FILES],
          maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: READER_FILE_PATTERN,
              handler: 'CacheFirst',
              options: {
                cacheName: MODELS_CACHE,
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/version\.json$/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
        },
      }),
    ],
  };
});
