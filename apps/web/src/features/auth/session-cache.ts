import type { Session } from '@repo/auth/client';

export const SESSION_KEY = 'courrier.session';

export type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** What the server answered: a session, none, or nothing at all. */
export type SessionLookup =
  | { kind: 'session'; session: Session }
  | { kind: 'none' }
  | { kind: 'unreachable' };

function readCached(store: SessionStore): Session | null {
  try {
    const raw = store.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
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
        store.setItem(SESSION_KEY, JSON.stringify(lookup.session));
      } catch {
        return lookup.session;
      }
      return lookup.session;
  }
}
