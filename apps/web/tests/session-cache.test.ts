import type { Session } from '@repo/auth/client';
import { describe, expect, it } from 'vitest';
import { resolveSession, SESSION_KEY } from '#/features/auth/session-cache';

const session = {
  user: { id: 'u1', name: 'Agent', email: 'agent@example.com', role: 'agent' },
  session: { id: 's1', userId: 'u1' },
} as unknown as Session;

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('resolveSession', () => {
  it('keeps the confirmed session on the device', () => {
    const store = memoryStore();
    expect(resolveSession({ kind: 'session', session }, store)).toBe(session);
    expect(JSON.parse(store.data.get(SESSION_KEY) ?? 'null')).toEqual(session);
  });

  it('stands in with the kept session while the server is unreachable', () => {
    const store = memoryStore({ [SESSION_KEY]: JSON.stringify(session) });
    expect(resolveSession({ kind: 'unreachable' }, store)).toEqual(session);
  });

  it('signs out when the server answers that there is no session', () => {
    const store = memoryStore({ [SESSION_KEY]: JSON.stringify(session) });
    expect(resolveSession({ kind: 'none' }, store)).toBeNull();
    expect(store.data.has(SESSION_KEY)).toBe(false);
  });

  it('has nothing to offer unreachable on a device that never signed in', () => {
    expect(resolveSession({ kind: 'unreachable' }, memoryStore())).toBeNull();
    expect(
      resolveSession(
        { kind: 'unreachable' },
        memoryStore({ [SESSION_KEY]: '{' }),
      ),
    ).toBeNull();
  });
});
