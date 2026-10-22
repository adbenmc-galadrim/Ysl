import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({ pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({
  auth: { api: {} },
  isAPIError: () => false,
}));

const { callerFor, sessionFor } = await import('./helpers/caller');

describe('protectedProcedure', () => {
  it('turns away a signed-out caller', async () => {
    await expect(callerFor(null).account.me()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('adminProcedure', () => {
  it('turns away an agent', async () => {
    await expect(
      callerFor(sessionFor('agent')).agents.list(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('account.me', () => {
  it('returns the role carried by the session', async () => {
    await expect(callerFor(sessionFor('admin')).account.me()).resolves.toEqual({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      role: 'admin',
    });
  });
});
