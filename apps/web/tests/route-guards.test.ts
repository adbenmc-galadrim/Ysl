import type { Session } from '@repo/auth/client';
import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/auth/client', () => ({ authClient: { getSession: vi.fn() } }));

const { requireAdmin, requireSession } = await import('#/features/auth/guards');
const { safeRedirect } = await import('#/features/auth/redirect');

const queryClientWith = (session: unknown) =>
  ({
    fetchQuery: () => Promise.resolve(session),
  }) as unknown as QueryClient;

const sessionWithRole = (role: string) =>
  ({ user: { role } }) as unknown as Session;

function thrownBy(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('requireSession', () => {
  it('sends a visitor without session to the sign-in page, remembering where they were going', async () => {
    await expect(
      requireSession(queryClientWith(null), '/colis?tri=date'),
    ).rejects.toMatchObject({
      options: { to: '/connexion', search: { redirect: '/colis?tri=date' } },
    });
  });
});

describe('requireAdmin', () => {
  it('sends an agent back to the home page', () => {
    expect(
      thrownBy(() => requireAdmin({ session: sessionWithRole('agent') })),
    ).toMatchObject({ options: { to: '/' } });
  });

  it('lets an admin through', () => {
    expect(() =>
      requireAdmin({ session: sessionWithRole('admin') }),
    ).not.toThrow();
  });
});

describe('safeRedirect', () => {
  it.each([
    '//evil.example',
    'https://evil.example/',
    '/\\evil.example',
    '/\t/evil.example',
  ])('rejects %s', (value) => {
    expect(safeRedirect(value)).toBeUndefined();
  });

  it('keeps an internal path', () => {
    expect(safeRedirect('/colis?tri=date')).toBe('/colis?tri=date');
  });
});
