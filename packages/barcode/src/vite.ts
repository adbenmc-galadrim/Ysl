import type { Plugin } from 'vite';

export const withoutCdn = (): Plugin => ({
  name: 'without-cdn',
  renderChunk: (code) =>
    code.replace(
      /https:\/\/(?:[\w-]+\.)*jsdelivr\.net\/npm\/zxing-wasm@[^/]+\/dist\//g,
      './',
    ),
});
