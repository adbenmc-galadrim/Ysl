import { env } from '@repo/shared/env/server';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema',
  out: './drizzle',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
