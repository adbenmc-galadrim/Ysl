import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // PGlite boots and replays every migration in `beforeAll`: about 9 s on a
    // CI runner, over Vitest's 10 s default.
    hookTimeout: 60_000,
  },
});
