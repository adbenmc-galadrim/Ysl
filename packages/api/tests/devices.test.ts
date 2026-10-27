import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import { session } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

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
const { AGENT_ID, STRANGER_ID } = await import('./helpers/pglite');

afterAll(async () => {
  await client.close();
});

const DAY = 24 * 60 * 60 * 1000;

function sessionRow(id: string, userId: string, offsetDays: number) {
  const now = Date.now();
  return {
    id,
    token: `token-${id}`,
    userId,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15',
    createdAt: new Date(now - 2 * DAY),
    updatedAt: new Date(now - DAY),
    expiresAt: new Date(now + offsetDays * DAY),
  };
}

function adminOn(sessionId: string, role = 'admin'): Session {
  const base = sessionFor(role);
  return {
    session: { ...base.session, id: sessionId, userId: AGENT_ID },
    user: { ...base.user, id: AGENT_ID },
  };
}

beforeEach(async () => {
  await db.delete(session);
  await db
    .insert(session)
    .values([
      sessionRow('mine', AGENT_ID, 30),
      sessionRow('phone', AGENT_ID, 30),
      sessionRow('expired', AGENT_ID, -1),
      sessionRow('elsewhere', STRANGER_ID, 30),
    ]);
});

describe('devices router', () => {
  it('keeps the list and the revocation to admins', async () => {
    const agent = callerFor(adminOn('mine', 'agent'));
    await expect(agent.devices.list()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(agent.devices.revoke({ id: 'phone' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lists the live sessions of the mailroom only, the current one marked', async () => {
    const devices = await callerFor(adminOn('mine')).devices.list();

    expect(devices.map((device) => [device.id, device.current]).sort()).toEqual(
      [
        ['mine', true],
        ['phone', false],
      ],
    );
    expect(devices[0]).toMatchObject({ userName: 'Agent' });
  });

  it('deletes the session of a device of the mailroom', async () => {
    await callerFor(adminOn('mine')).devices.revoke({ id: 'phone' });

    const left = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, AGENT_ID));
    expect(left.map((row) => row.id).sort()).toEqual(['expired', 'mine']);
  });

  it('refuses a device of another mailroom, and the admin’s own', async () => {
    const admin = callerFor(adminOn('mine'));

    await expect(
      admin.devices.revoke({ id: 'elsewhere' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(admin.devices.revoke({ id: 'mine' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    const all = await db.select({ id: session.id }).from(session);
    expect(all).toHaveLength(4);
  });
});
