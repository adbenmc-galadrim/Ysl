import { defineConfig } from 'vitest/config';

/**
 * The layout test drives a real browser on a Vite server: kept out of
 * `pnpm test`, it runs where Playwright's browsers are installed
 * (`pnpm --filter @repo/web test:layout`, job `visual` of the CI). One
 * file at a time: each starts its own Vite server on the app's root, and
 * two optimising its dependencies at once reload each other's pages.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/layout/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
