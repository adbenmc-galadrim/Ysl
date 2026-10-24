import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // PGlite boots and replays every migration in `beforeAll`.
    hookTimeout: 60_000,
  },
});
