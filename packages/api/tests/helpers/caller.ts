import type { Session } from '@repo/auth';
import { appRouter } from '#root';
import { createTRPCContext } from '#lib/trpc';

export function sessionFor(role: string | null): Session {
  const now = new Date();
  return {
    session: {
      id: 'session-1',
      token: 'token-1',
      userId: 'user-1',
      createdAt: now,
      updatedAt: now,
      expiresAt: now,
    },
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      role,
      banned: false,
    },
  };
}

export const HEADERS = new Headers({ cookie: 'session=abc' });

export function callerFor(session: Session | null) {
  return appRouter.createCaller(
    createTRPCContext({ headers: HEADERS, session }),
  );
}
