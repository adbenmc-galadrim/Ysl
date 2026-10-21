import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const URL_VARIABLES = ['CORS_ORIGIN', 'DATABASE_URL'];

async function loadEnv() {
  vi.resetModules();
  const module = await import('#env/server');
  return module.env;
}

describe('server env', () => {
  beforeEach(() => {
    for (const name of URL_VARIABLES) vi.stubEnv(name, '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to local defaults outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const env = await loadEnv();

    expect(env.DATABASE_URL).toMatch(
      /^postgresql:\/\/.*@localhost:\d+\/courrier$/,
    );
    expect(env.CORS_ORIGIN).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it('requires DATABASE_URL in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', 'https://courrier.example');

    await expect(loadEnv()).rejects.toThrow(/Invalid environment variables/);

    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://user:pass@db.example:5432/courrier',
    );

    await expect(loadEnv()).resolves.toMatchObject({
      DATABASE_URL: 'postgresql://user:pass@db.example:5432/courrier',
    });
  });
});
