import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  revokeUserSessions: vi.fn(),
  setUserPassword: vi.fn(),
}));

vi.mock('@repo/db', () => ({ pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({ auth: { api }, isAPIError: () => false }));

const { HEADERS, callerFor, sessionFor } = await import('./helpers/caller');

const admin = () => callerFor(sessionFor('admin'));

const createdUser = (role: string) => ({
  user: {
    id: 'user-2',
    name: 'Agent Test',
    email: 'agent@example.com',
    role,
    banned: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
});

describe('agents.create', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('creates an agent by default', async () => {
    api.createUser.mockResolvedValue(createdUser('agent'));

    await admin().agents.create({
      name: 'Agent Test',
      email: 'agent@example.com',
      password: 'motdepasse-1',
    });

    expect(api.createUser.mock.calls[0]?.[0]).toMatchObject({
      body: { role: 'agent' },
    });
  });

  it('passes the requested role to Better Auth', async () => {
    api.createUser.mockResolvedValue(createdUser('admin'));

    const created = await admin().agents.create({
      name: 'Admin Test',
      email: 'admin@example.com',
      password: 'motdepasse-1',
      role: 'admin',
    });

    expect(api.createUser.mock.calls[0]?.[0]).toMatchObject({
      body: { role: 'admin' },
    });
    expect(created.role).toBe('admin');
  });
});

describe('agents.setActive', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('bans the account and revokes its sessions when deactivating', async () => {
    await admin().agents.setActive({ userId: 'user-2', active: false });

    expect(api.banUser).toHaveBeenCalledWith({
      headers: HEADERS,
      body: { userId: 'user-2' },
    });
    expect(api.revokeUserSessions).toHaveBeenCalledWith({
      headers: HEADERS,
      body: { userId: 'user-2' },
    });
  });
});
