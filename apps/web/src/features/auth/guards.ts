import type { Session } from '@repo/auth/client';
import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { sessionQueryOptions } from '#/features/auth/api/session';
import { safeRedirect } from '#/features/auth/redirect';

export async function requireSession(
  queryClient: QueryClient,
  href: string,
  { installed }: { installed: boolean },
) {
  const session = await queryClient.fetchQuery(sessionQueryOptions);
  if (!session) {
    if (!installed && new URL(href, 'http://app').pathname === '/') {
      throw redirect({ to: '/bienvenue' });
    }
    throw redirect({ to: '/connexion', search: { redirect: href } });
  }
  return session;
}

export async function redirectIfSignedIn(
  queryClient: QueryClient,
  target?: string,
) {
  const session = await queryClient.fetchQuery(sessionQueryOptions);
  if (!session) return;
  const href = safeRedirect(target);
  throw href ? redirect({ href }) : redirect({ to: '/' });
}

export function requireAdmin({ session }: { session: Session }) {
  if (session.user.role !== 'admin') throw redirect({ to: '/' });
}
