import type { Session } from '@repo/auth/client';

export const SESSION_KEY = 'courrier.session';

export type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** What the server answered: a session, none, or nothing at all. */
export type SessionLookup =
  | { kind: 'session'; session: Session }
  | { kind: 'none' }
  | { kind: 'unreachable' };

/** What `getSession` gave, the way the client returns it. */
export type SessionAnswer = {
  data?: unknown;
  error?: { status: number } | null;
};

const isSession = (data: unknown): data is Session =>
  typeof data === 'object' && data !== null && 'user' in data;

/**
 * Only the auth server saying so ends a session: it answers `null` or 401. A
 * proxy's error or page during a deployment, whatever its status, says nothing
 * of the session, and answering "none" would empty the device (§9.1).
 */
export function readSessionAnswer({
  data,
  error,
}: SessionAnswer): SessionLookup {
  if (isSession(data)) return { kind: 'session', session: data };
  if (error)
    return error.status === 401 ? { kind: 'none' } : { kind: 'unreachable' };
  return data === null || data === undefined
    ? { kind: 'none' }
    : { kind: 'unreachable' };
}

function readCached(store: SessionStore): Session | null {
  try {
    const raw = store.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** The cookie carries the token; the device copy only needs who is signed in. */
function withoutToken(session: Session): Omit<Session, 'session'> & {
  session: Omit<Session['session'], 'token'>;
} {
  const { token: _token, ...rest } = session.session;
  void _token;
  return { ...session, session: rest };
}

/**
 * The installed app must open in airplane mode (F45): the last session the
 * server confirmed stays on the device and stands in while it is unreachable.
 * A definite answer, with or without a session, always replaces it.
 */
export function resolveSession(
  lookup: SessionLookup,
  store: SessionStore,
): Session | null {
  switch (lookup.kind) {
    case 'unreachable':
      return readCached(store);
    case 'none':
      store.removeItem(SESSION_KEY);
      return null;
    case 'session':
      try {
        store.setItem(
          SESSION_KEY,
          JSON.stringify(withoutToken(lookup.session)),
        );
      } catch {
        /* a full or disabled storage only costs the offline relaunch */
      }
      return lookup.session;
  }
}

/**
 * A device that kept a session and is now told there is none was signed out
 * from elsewhere: revoked by an admin, account deactivated, password reset,
 * or expired. It empties itself as "Effacer les données de cet iPhone" does
 * (§9.1) before showing sign-in. A sign-out from this device forgets the
 * kept session before asking the server, so it is not taken for one; an
 * unreachable server changes nothing.
 */
export async function settleSession(
  lookup: SessionLookup,
  store: SessionStore,
  wipe: () => Promise<void>,
): Promise<Session | null> {
  if (lookup.kind === 'none' && store.getItem(SESSION_KEY) !== null) {
    await wipe();
  }
  return resolveSession(lookup, store);
}

/** Signing out forgets the kept session at once, before the server confirms. */
export function forgetSession(store: SessionStore): void {
  store.removeItem(SESSION_KEY);
}
