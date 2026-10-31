import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({
  db,
  pingDb: vi.fn(),
  withConnection: (work: (conn: typeof db) => Promise<unknown>) => work(db),
}));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));

const { callerFor, sessionFor } = await import('./helpers/caller');
const { AGENT_ID } = await import('./helpers/pglite');

afterAll(async () => {
  await client.close();
});

function memberSession(role: string): Session {
  const session = sessionFor(role);
  return {
    session: { ...session.session, userId: AGENT_ID },
    user: { ...session.user, id: AGENT_ID },
  };
}

describe('maintenance router', () => {
  it('keeps the purge to admins', async () => {
    const shuttle = callerFor(memberSession('shuttle'));
    await expect(shuttle.maintenance.status()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(shuttle.maintenance.purgeNow()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('purges the admin’s mailroom by hand and reports it', async () => {
    const admin = callerFor(memberSession('company_admin'));
    await expect(admin.maintenance.status()).resolves.toEqual({ last: null });

    const outcome = await admin.maintenance.purgeNow();

    expect(outcome).toMatchObject({
      status: 'done',
      run: { trigger: 'manual', counts: {} },
    });
    await expect(admin.maintenance.status()).resolves.toMatchObject({
      last: { trigger: 'manual' },
    });
  });
});
