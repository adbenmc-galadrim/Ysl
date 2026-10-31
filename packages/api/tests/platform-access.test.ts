import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import * as schema from '@repo/db/schema';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({
  db,
  pingDb: vi.fn(),
  withConnection: (work: (conn: typeof db) => Promise<unknown>) => work(db),
}));
vi.mock('@repo/auth', () => ({
  auth: { api: {} },
  isAPIError: () => false,
}));

const { appRouter } = await import('#root');
const { callerFor, codeOf, sessionFor } = await import('./helpers/caller');
const { AGENT_ID } = await import('./helpers/pglite');

const PLATFORM_ID = 'platform-1';
const OPEN_TO_PLATFORM = ['account.me', 'health.check', 'platform.overview'];

function sessionOf(role: string | null, userId: string): Session {
  const base = sessionFor(role);
  return {
    session: { ...base.session, userId },
    user: { ...base.user, id: userId },
  };
}

type Callable = (input: unknown) => Promise<unknown>;

function procedureAt(caller: unknown, path: string): Callable {
  return path
    .split('.')
    .reduce(
      (node, key) => (node as Record<string, unknown>)[key],
      caller,
    ) as Callable;
}

beforeAll(async () => {
  await db.insert(schema.user).values({
    id: PLATFORM_ID,
    name: 'Admin app',
    email: 'plateforme@example.test',
    role: 'platform_admin',
  });
});

afterAll(async () => {
  await client.close();
});

describe('the app admin', () => {
  const caller = () => callerFor(sessionOf('platform_admin', PLATFORM_ID));
  const paths = Object.keys(appRouter._def.procedures);

  it.each(paths.filter((path) => !OPEN_TO_PLATFORM.includes(path)))(
    'is refused on %s',
    async (path) => {
      expect(await codeOf(procedureAt(caller(), path)({}))).toBe('FORBIDDEN');
    },
  );

  it('reads figures with no name in them', async () => {
    expect(await caller().platform.overview()).toEqual({ companies: 2 });
  });

  it('reads only its own account', async () => {
    expect(await caller().account.me()).toMatchObject({
      id: PLATFORM_ID,
      role: 'platform_admin',
    });
  });
});

describe('platform.overview', () => {
  it.each(['agent', 'admin', 'company_admin', 'department', 'shuttle', null])(
    'refuses the role %s',
    async (role) => {
      const caller = callerFor(sessionOf(role, AGENT_ID));
      expect(await codeOf(caller.platform.overview())).toBe('FORBIDDEN');
    },
  );

  it('refuses a platform role on an account attached to a company', async () => {
    const caller = callerFor(sessionOf('platform_admin', AGENT_ID));
    expect(await codeOf(caller.platform.overview())).toBe('FORBIDDEN');
  });

  it('refuses without a session', async () => {
    expect(await codeOf(callerFor(null).platform.overview())).toBe(
      'UNAUTHORIZED',
    );
  });
});
