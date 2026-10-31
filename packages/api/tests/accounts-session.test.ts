import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@repo/db/schema';
import { eq } from 'drizzle-orm';

// The real Better Auth, not a made-up session: its reading of the session is what is tested.
const { client, db } = await vi.hoisted(async () => {
  process.env.SKIP_ENV_VALIDATION = '1';
  process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-00';
  process.env.BETTER_AUTH_URL = 'http://localhost:3101';
  process.env.CORS_ORIGIN = 'http://localhost:3100';
  process.env.LOG_LEVEL = 'silent';
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({
  db,
  pingDb: vi.fn(),
  withConnection: (work: (conn: typeof db) => Promise<unknown>) => work(db),
}));

const { auth } = await import('@repo/auth');
const { credentialRow } = await import('@repo/auth/password');
const { appRouter } = await import('#root');
const { createTRPCContext } = await import('#lib/trpc');
const { codeOf } = await import('./helpers/caller');
const { ORGANIZATION_ID } = await import('./helpers/pglite');

const NINA = 'nina-1';
const PASSWORD = 'motdepasse';
let cookie = '';

async function caller() {
  const headers = new Headers({ cookie });
  const session = await auth.api.getSession({ headers });
  return appRouter.createCaller(createTRPCContext({ headers, session }));
}

beforeAll(async () => {
  await db.insert(schema.user).values({
    id: NINA,
    name: 'Nina',
    email: 'nina@example.test',
    role: 'shuttle',
  });
  await db.insert(schema.account).values(await credentialRow(NINA, PASSWORD));
  await db
    .insert(schema.organizationMember)
    .values({ userId: NINA, organizationId: ORGANIZATION_ID });
  const { headers } = await auth.api.signInEmail({
    body: { email: 'nina@example.test', password: PASSWORD },
    returnHeaders: true,
  });
  cookie = (headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  expect(cookie).toContain('=');
}, 60_000);

afterAll(async () => {
  await client.close();
});

describe('a signed-in device, between two of its requests', () => {
  it('reads the new role at the next request, on the same session', async () => {
    expect((await (await caller()).account.me()).role).toBe('shuttle');
    await db
      .update(schema.user)
      .set({ role: 'department' })
      .where(eq(schema.user.id, NINA));
    expect((await (await caller()).account.me()).role).toBe('department');
    await db
      .update(schema.user)
      .set({ role: 'shuttle' })
      .where(eq(schema.user.id, NINA));
  });

  it('is refused once suspended, keeps its session, and resumes', async () => {
    await db
      .update(schema.user)
      .set({ banned: true, banReason: 'suspended' })
      .where(eq(schema.user.id, NINA));
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(session?.user.banned).toBe(true);
    expect(await codeOf((await caller()).account.me())).toBe('FORBIDDEN');
    await db
      .update(schema.user)
      .set({ banned: false, banReason: null })
      .where(eq(schema.user.id, NINA));
    expect((await (await caller()).account.me()).role).toBe('shuttle');
  });
});
