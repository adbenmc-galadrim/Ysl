import viteReact from '@vitejs/plugin-react';
import {
  defaultClientConditions,
  defineConfig,
  type Connect,
  type Plugin,
} from 'vite';

const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

const setIsolation: Connect.NextHandleFunction = (_request, response, next) => {
  for (const [name, value] of Object.entries(isolation)) {
    response.setHeader(name, value);
  }
  next();
};

const crossOriginIsolation: Plugin = {
  name: 'cross-origin-isolation',
  configureServer: (server) => void server.middlewares.use(setIsolation),
  configurePreviewServer: (server) => void server.middlewares.use(setIsolation),
};

const listen = {
  host: '127.0.0.1',
  port: 3106,
  strictPort: true,
  allowedHosts: ['.ts.net'],
};

export default defineConfig({
  base: '/spike-ocr/',
  server: listen,
  preview: listen,
  resolve: {
    tsconfigPaths: true,
    conditions: [...defaultClientConditions, 'onnxruntime-web-use-extern-wasm'],
  },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  plugins: [crossOriginIsolation, viteReact()],
});
