import type { Session } from '@repo/auth/client';
import {
  markCompanySuspended,
  suspendedAccount,
} from '#/features/auth/company-suspension';

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
 * proxy's error or page during a deployment says nothing of the session, and
 * answering "none" would empty the device (§9.1). A proxy's 401 cannot be told
 * from the server's and still counts.
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

/** The server's word on an account that lost its session; `unknown` when it cannot be reached. */
export type AccountSuspension = {
  standing: 'suspended' | 'active' | 'gone' | 'unknown';
  reactivatedAt?: Date | null;
};

/** It ran out by itself before the company came back: suspended, maybe with the phone shut. */
function ranOutBefore(kept: Session, reactivatedAt?: Date | null): boolean {
  return Boolean(
    reactivatedAt && new Date(kept.session.expiresAt) <= reactivatedAt,
  );
}

/**
 * A device that kept a session and is now told there is none was signed out
 * from elsewhere: account revoked by an admin, device or sessions closed, or
 * expired. A suspended account keeps its session and never gets here. It empties itself as "Effacer les données de cet iPhone" does
 * (§9.1) before showing sign-in. A sign-out from this device forgets the
 * kept session before asking the server, so it is not taken for one; an
 * unreachable server changes nothing.
 *
 * Except a suspended company's phone: a session can run out during a long
 * suspension, and the proofs on the phone exist nowhere else (D8). It asks
 * first and keeps everything when in doubt. Once reactivated, the account signs
 * in again and finds its data; another account signing in empties the phone,
 * and so does a deleted company.
 */
export async function settleSession(
  lookup: SessionLookup,
  store: SessionStore,
  wipe: () => Promise<void>,
  suspensionOf: (userId: string) => Promise<AccountSuspension>,
): Promise<Session | null> {
  if (lookup.kind === 'session') {
    const owner = suspendedAccount(store);
    if (owner && owner !== lookup.session.user.id) await wipe();
    return resolveSession(lookup, store);
  }
  if (lookup.kind === 'unreachable') return resolveSession(lookup, store);
  const kept = readCached(store);
  if (kept) {
    const { standing, reactivatedAt } = await suspensionOf(kept.user.id);
    if (standing === 'unknown') return kept;
    if (standing === 'suspended') {
      markCompanySuspended(store, kept.user.id);
      return kept;
    }
    if (
      standing === 'active' &&
      (suspendedAccount(store) === kept.user.id ||
        ranOutBefore(kept, reactivatedAt))
    ) {
      markCompanySuspended(store, kept.user.id);
      return resolveSession(lookup, store);
    }
  }
  if (store.getItem(SESSION_KEY) !== null) await wipe();
  return resolveSession(lookup, store);
}

/** Who the device's data belongs to, as far as it knows. */
export function keptAccount(store: SessionStore): string | null {
  return readCached(store)?.user.id ?? null;
}

/** Signing out forgets the kept session at once, before the server confirms. */
export function forgetSession(store: SessionStore): void {
  store.removeItem(SESSION_KEY);
}
