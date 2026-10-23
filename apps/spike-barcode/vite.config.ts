import viteReact from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const listen = {
  host: '127.0.0.1',
  port: 3105,
  strictPort: true,
  allowedHosts: ['.ts.net'],
};

const withoutCdn = (): Plugin => ({
  name: 'without-cdn',
  renderChunk: (code) =>
    code.replace(
      /https:\/\/fastly\.jsdelivr\.net\/npm\/zxing-wasm@[^/]+\/dist\//g,
      './',
    ),
});

export default defineConfig({
  base: '/spike-barcode/',
  server: listen,
  preview: listen,
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
  worker: { format: 'es', plugins: () => [withoutCdn()] },
  build: { target: 'esnext' },
});
