import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/auth/client', () => ({ authClient: { getSession: vi.fn() } }));

const { requireSession } = await import('#/features/auth/guards');
const { safeRedirect } = await import('#/features/auth/redirect');

const queryClientWith = (session: unknown) =>
  ({
    fetchQuery: () => Promise.resolve(session),
  }) as unknown as QueryClient;

describe('requireSession', () => {
  it('sends a visitor without session to the sign-in page, remembering where they were going', async () => {
    await expect(
      requireSession(queryClientWith(null), '/colis?tri=date', {
        installed: false,
      }),
    ).rejects.toMatchObject({
      options: { to: '/connexion', search: { redirect: '/colis?tri=date' } },
    });
  });

  it('shows the landing to a visitor without session who opens the home page', async () => {
    await expect(
      requireSession(queryClientWith(null), '/', { installed: false }),
    ).rejects.toMatchObject({
      options: { to: '/bienvenue' },
    });
  });

  it('shows the landing whatever the query string on the home page', async () => {
    await expect(
      requireSession(queryClientWith(null), '/?utm_source=qr', {
        installed: false,
      }),
    ).rejects.toMatchObject({ options: { to: '/bienvenue' } });
  });

  it('sends the installed app without session to the sign-in page, not the landing', async () => {
    await expect(
      requireSession(queryClientWith(null), '/', { installed: true }),
    ).rejects.toMatchObject({ options: { to: '/connexion' } });
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
