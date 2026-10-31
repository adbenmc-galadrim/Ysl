import { fileURLToPath } from 'node:url';
import { COMPANY_SUSPENDED } from '@repo/contract/auth';
import * as schema from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { client, db } = await vi.hoisted(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const dbSchema = await import('@repo/db/schema');
  const pglite = new PGlite();
  return { client: pglite, db: drizzle({ client: pglite, schema: dbSchema }) };
});

vi.mock('@repo/db', () => ({ db }));
vi.mock('@repo/shared/env/server', () => ({
  env: {
    BETTER_AUTH_URL: 'http://localhost:3101',
    BETTER_AUTH_SECRET: 'a-secret-of-at-least-thirty-two-characters',
    CORS_ORIGIN: 'http://localhost:3100',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
  },
}));

const CREDENTIALS = {
  email: 'navette@example.test',
  password: 'un-mot-de-passe-long',
};

const { auth } = await import('#auth');
const { attachToOrganization, createCompany } = await import('#organization');

let companyId: string;

beforeAll(async () => {
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../db/drizzle', import.meta.url),
    ),
  });
  companyId = await createCompany(db, {
    name: 'Atelier',
    profileModel: 'small_site',
  });
  const { user } = await auth.api.createUser({
    body: { ...CREDENTIALS, name: 'Navette', role: 'shuttle' },
  });
  await attachToOrganization(db, user.id, companyId);
}, 60_000);

afterAll(async () => {
  await client.close();
});

const setSuspended = (at: Date | null) =>
  db
    .update(schema.organization)
    .set({ suspendedAt: at })
    .where(eq(schema.organization.id, companyId));

describe('signing in', () => {
  it('works for an active company', async () => {
    const answer = await auth.api.signInEmail({ body: CREDENTIALS });
    expect(answer.user.email).toBe(CREDENTIALS.email);
  });

  it('is refused with its reason once the company is suspended, and works again after', async () => {
    await setSuspended(new Date());
    await expect(
      auth.api.signInEmail({ body: CREDENTIALS }),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: COMPANY_SUSPENDED },
    });
    await setSuspended(null);
    await expect(
      auth.api.signInEmail({ body: CREDENTIALS }),
    ).resolves.toMatchObject({ user: { email: CREDENTIALS.email } });
  });

  it('keeps a wrong password a wrong password, suspended or not', async () => {
    await setSuspended(new Date());
    await expect(
      auth.api.signInEmail({
        body: { ...CREDENTIALS, password: 'pas-le-bon-mot-de-passe' },
      }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
    await setSuspended(null);
  });
});
