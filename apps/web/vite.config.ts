import { resolve } from 'node:path';
import { SERVER_PORT, WEB_PORT } from '@repo/shared/env/ports';
import { DEFAULT_LOCALE } from '@repo/shared/i18n';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

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
  if (!appName || !serverUrl) {
    throw new Error(
      'PUBLIC_APP_NAME and PUBLIC_SERVER_URL are required for a production build.',
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
    },
    optimizeDeps: {
      exclude: ['@repo/shared'],
    },
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
    ],
  };
});
