import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
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

describe('agents.create, roles', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it.each(['platform_admin', 'company_admin', 'department', 'shuttle'])(
    'refuses to hand out %s',
    async (role) => {
      await expect(
        admin().agents.create({
          name: 'Test',
          email: 'test@example.com',
          password: 'motdepasse-1',
          role: role as 'agent',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(api.createUser).not.toHaveBeenCalled();
    },
  );
});

describe('agents.setActive', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.getUser.mockResolvedValue({ role: 'agent' });
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

describe('agents, app admin accounts', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.getUser.mockResolvedValue({ role: 'platform_admin' });
  });

  it('leaves them out of the list', async () => {
    api.listUsers.mockResolvedValue({
      users: [
        createdUser('agent').user,
        { ...createdUser('platform_admin').user, id: 'app-admin' },
      ],
    });

    const agents = await admin().agents.list();

    expect(agents.map((agent) => agent.id)).toEqual(['user-2']);
  });

  it.each([true, false])('refuses setActive to %s', async (active) => {
    await expect(
      admin().agents.setActive({ userId: 'app-admin', active }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(api.banUser).not.toHaveBeenCalled();
    expect(api.unbanUser).not.toHaveBeenCalled();
    expect(api.revokeUserSessions).not.toHaveBeenCalled();
  });

  it('refuses a password reset', async () => {
    await expect(
      admin().agents.resetPassword({
        userId: 'app-admin',
        password: 'motdepasse-1',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(api.setUserPassword).not.toHaveBeenCalled();
    expect(api.revokeUserSessions).not.toHaveBeenCalled();
  });

  it('refuses when the role of the target is unknown', async () => {
    api.getUser.mockResolvedValue({});

    await expect(
      admin().agents.resetPassword({
        userId: 'app-admin',
        password: 'motdepasse-1',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(api.setUserPassword).not.toHaveBeenCalled();
  });

  it('still resets the password of an agent', async () => {
    api.getUser.mockResolvedValue({ role: 'agent' });

    await admin().agents.resetPassword({
      userId: 'user-2',
      password: 'motdepasse-1',
    });

    expect(api.setUserPassword).toHaveBeenCalledOnce();
  });
});
