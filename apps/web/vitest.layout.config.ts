import { defineConfig } from 'vitest/config';

/**
 * The layout test drives a real browser on a Vite server: kept out of
 * `pnpm test`, it runs where Playwright's browsers are installed
 * (`pnpm --filter @repo/web test:layout`, job `visual` of the CI).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/layout/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
