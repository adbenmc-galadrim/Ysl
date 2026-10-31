import { authClient } from '@repo/auth/client';
import { queryOptions } from '@tanstack/react-query';
import {
  readSessionAnswer,
  settleSession,
  type SessionLookup,
} from '#/features/auth/session-cache';

/** Loaded on demand: the guards stay free of the database and the service worker. */
async function wipeLocalData(): Promise<void> {
  const { wipeLocalData: wipe } = await import('#/features/auth/wipe');
  await wipe();
}

async function lookupSession(): Promise<SessionLookup> {
  try {
    return readSessionAnswer(await authClient.getSession());
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
