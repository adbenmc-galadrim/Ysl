import viteReact from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/spike-storage/';
const VERSION = new Date().toISOString();

const listen = {
  host: '127.0.0.1',
  port: 3103,
  strictPort: true,
  allowedHosts: ['.ts.net'],
};

function versionFile(): Plugin {
  const source = JSON.stringify({ version: VERSION, builtAt: VERSION });
  return {
    name: 'spike-storage-version',
    configureServer(server) {
      server.middlewares.use(`${BASE}version.json`, (_request, response) => {
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

export default defineConfig({
  base: BASE,
  server: listen,
  preview: listen,
  resolve: { tsconfigPaths: true },
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [
    viteReact(),
    versionFile(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['version.json'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
