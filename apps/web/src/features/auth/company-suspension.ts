import type { SessionStore } from '#/features/auth/session-cache';

const SUSPENDED_KEY = 'courrier.companySuspended';

const listeners = new Set<() => void>();

/** Survives a relaunch in airplane mode: told once, the phone stays told until the server says otherwise. */
export function isCompanySuspended(store: SessionStore): boolean {
  return store.getItem(SUSPENDED_KEY) !== null;
}

function changed(): void {
  for (const listener of listeners) listener();
}

/** The account the phone's data belongs to: another one signing in must not find it. */
export function suspendedAccount(store: SessionStore): string | null {
  return store.getItem(SUSPENDED_KEY);
}

export function markCompanySuspended(
  store: SessionStore,
  userId: string,
): void {
  if (isCompanySuspended(store)) return;
  store.setItem(SUSPENDED_KEY, userId);
  changed();
}

export function clearCompanySuspended(store: SessionStore): void {
  if (!isCompanySuspended(store)) return;
  store.removeItem(SUSPENDED_KEY);
  changed();
}

export function subscribeCompanySuspended(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
