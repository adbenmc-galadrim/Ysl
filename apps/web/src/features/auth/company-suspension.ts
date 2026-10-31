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

export function markCompanySuspended(store: SessionStore): void {
  if (isCompanySuspended(store)) return;
  store.setItem(SUSPENDED_KEY, '1');
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
