import { authClient } from '@repo/auth/client';
import { queryOptions } from '@tanstack/react-query';
import {
  settleSession,
  type SessionLookup,
} from '#/features/auth/session-cache';

/** Only a clear "no session" signs the device out; anything else is noise. */
const SIGNED_OUT_STATUSES = new Set([401, 403]);

/** Loaded on demand: the guards stay free of the database and the service worker. */
async function wipeLocalData(): Promise<void> {
  const { wipeLocalData: wipe } = await import('#/features/auth/wipe');
  await wipe();
}

async function lookupSession(): Promise<SessionLookup> {
  try {
    const { data, error } = await authClient.getSession();
    if (data) return { kind: 'session', session: data };
    if (!error || SIGNED_OUT_STATUSES.has(error.status))
      return { kind: 'none' };
    return { kind: 'unreachable' };
  } catch {
    return { kind: 'unreachable' };
  }
}

export const sessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: async () =>
    settleSession(await lookupSession(), localStorage, wipeLocalData),
  staleTime: 5 * 60 * 1000,
  // Offline, the query must still run: the kept session is the answer.
  networkMode: 'always',
});
