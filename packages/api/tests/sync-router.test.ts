import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({ db, pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));

const { callerFor, sessionFor } = await import('./helpers/caller');
const { AGENT_ID } = await import('./helpers/pglite');

afterAll(async () => {
  await client.close();
});

function memberSession(userId: string): Session {
  const session = sessionFor('shuttle');
  return {
    session: { ...session.session, userId },
    user: { ...session.user, id: userId },
  };
}

describe('memberProcedure', () => {
  it('turns away an account no mailroom attached', async () => {
    await expect(
      callerFor(memberSession('nobody')).sync.pull({ cursor: null }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets a member pull its mailroom', async () => {
    await expect(
      callerFor(memberSession(AGENT_ID)).sync.pull({ cursor: null }),
    ).resolves.toMatchObject({
      reset: false,
      next: null,
      rows: [],
      serverMail: false,
    });
  });
});
