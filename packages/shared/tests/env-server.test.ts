import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REQUIRED_IN_PRODUCTION = [
  'CORS_ORIGIN',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
];

async function loadEnv() {
  vi.resetModules();
  const module = await import('#env/server');
  return module.env;
}

describe('server env', () => {
  beforeEach(() => {
    for (const name of REQUIRED_IN_PRODUCTION) vi.stubEnv(name, '');
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
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.BETTER_AUTH_URL).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it('requires DATABASE_URL in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', 'https://courrier.example');
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.courrier.example');
    vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32));

    await expect(loadEnv()).rejects.toThrow(/Invalid environment variables/);

    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://user:pass@db.example:5432/courrier',
    );

    await expect(loadEnv()).resolves.toMatchObject({
      DATABASE_URL: 'postgresql://user:pass@db.example:5432/courrier',
    });
  });

  it('requires BETTER_AUTH_SECRET in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', 'https://courrier.example');
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.courrier.example');
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://user:pass@db.example:5432/courrier',
    );

    await expect(loadEnv()).rejects.toThrow(/Invalid environment variables/);

    vi.stubEnv('BETTER_AUTH_SECRET', 'short');

    await expect(loadEnv()).rejects.toThrow(/Invalid environment variables/);
  });
});
