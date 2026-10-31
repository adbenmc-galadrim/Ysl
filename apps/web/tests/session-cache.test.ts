import type { Session } from '@repo/auth/client';
import { describe, expect, it, vi } from 'vitest';
import {
  forgetSession,
  resolveSession,
  SESSION_KEY,
  settleSession,
} from '#/features/auth/session-cache';

const session = {
  user: {
    id: 'u1',
    name: 'Agent',
    email: 'agent@example.com',
    role: 'shuttle',
  },
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

  it('forgets the kept session at sign-out', () => {
    const store = memoryStore({ [SESSION_KEY]: JSON.stringify(session) });
    forgetSession(store);
    expect(resolveSession({ kind: 'unreachable' }, store)).toBeNull();
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

describe('settleSession', () => {
  const kept = () => memoryStore({ [SESSION_KEY]: JSON.stringify(session) });

  it('empties a device whose kept session was ended elsewhere', async () => {
    const store = kept();
    const wipe = vi.fn(() => {
      store.removeItem(SESSION_KEY);
      return Promise.resolve();
    });

    await expect(settleSession({ kind: 'none' }, store, wipe)).resolves.toBe(
      null,
    );
    expect(wipe).toHaveBeenCalledOnce();
    expect(store.data.has(SESSION_KEY)).toBe(false);
  });

  it('leaves the device alone offline, signed in, or never signed in', async () => {
    const wipe = vi.fn(() => Promise.resolve());

    await expect(
      settleSession({ kind: 'unreachable' }, kept(), wipe),
    ).resolves.toEqual(session);
    await settleSession({ kind: 'session', session }, kept(), wipe);
    await settleSession({ kind: 'none' }, memoryStore(), wipe);
    expect(wipe).not.toHaveBeenCalled();
  });
});
