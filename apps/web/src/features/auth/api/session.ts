import { authClient } from '@repo/auth/client';
import { queryOptions } from '@tanstack/react-query';
import {
  resolveSession,
  type SessionLookup,
} from '#/features/auth/session-cache';

async function lookupSession(): Promise<SessionLookup> {
  try {
    const { data, error } = await authClient.getSession();
    if (data) return { kind: 'session', session: data };
    const status = error?.status ?? 0;
    const unreachable = status === 0 || status >= 500 || !navigator.onLine;
    return error && unreachable ? { kind: 'unreachable' } : { kind: 'none' };
  } catch {
    return { kind: 'unreachable' };
  }
}

export const sessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: async () => resolveSession(await lookupSession(), localStorage),
  staleTime: 5 * 60 * 1000,
});
