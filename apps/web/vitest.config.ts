import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Needs a browser: `test:layout` (`vitest.layout.config.ts`).
    exclude: ['tests/layout/**'],
    globals: false,
  },
});
