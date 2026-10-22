import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const PORT = 3102;

export default defineConfig({
  server: { port: PORT, strictPort: true, allowedHosts: ['.ts.net'] },
  preview: { port: PORT, strictPort: true, allowedHosts: ['.ts.net'] },
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
});
