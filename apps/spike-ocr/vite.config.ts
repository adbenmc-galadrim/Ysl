import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

const listen = {
  host: '127.0.0.1',
  port: 3106,
  strictPort: true,
  allowedHosts: ['.ts.net'],
  headers: isolation,
};

export default defineConfig({
  base: '/spike-ocr/',
  server: listen,
  preview: listen,
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
});
