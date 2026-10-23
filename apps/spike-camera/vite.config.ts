import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const listen = {
  host: '127.0.0.1',
  port: 3102,
  strictPort: true,
  allowedHosts: ['.ts.net'],
};

export default defineConfig({
  base: '/spike-camera/',
  server: listen,
  preview: listen,
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
});
