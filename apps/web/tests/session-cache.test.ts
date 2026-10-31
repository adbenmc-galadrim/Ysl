import type { Session } from '@repo/auth/client';
import { describe, expect, it, vi } from 'vitest';
import {
  forgetSession,
  resolveSession,
  SESSION_KEY,
  settleSession,
} from '#/features/auth/session-cache';
import {
  isCompanySuspended,
  markCompanySuspended,
} from '#/features/auth/company-suspension';

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

const active = () => Promise.resolve('active' as const);

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

    await expect(
      settleSession({ kind: 'none' }, store, wipe, active),
    ).resolves.toBe(null);
    expect(wipe).toHaveBeenCalledOnce();
    expect(store.data.has(SESSION_KEY)).toBe(false);
  });

  it('leaves the device alone offline, signed in, or never signed in', async () => {
    const wipe = vi.fn(() => Promise.resolve());

    await expect(
      settleSession({ kind: 'unreachable' }, kept(), wipe, active),
    ).resolves.toEqual(session);
    await settleSession({ kind: 'session', session }, kept(), wipe, active);
    await settleSession({ kind: 'none' }, memoryStore(), wipe, active);
    expect(wipe).not.toHaveBeenCalled();
  });
});

describe('a phone of a suspended company that lost its session', () => {
  const keptStore = () =>
    memoryStore({ [SESSION_KEY]: JSON.stringify(session) });

  it('keeps everything, the session too, and remembers why', async () => {
    const store = keptStore();
    const wipe = vi.fn(() => Promise.resolve());
    const answer = await settleSession({ kind: 'none' }, store, wipe, () =>
      Promise.resolve('suspended'),
    );
    expect(wipe).not.toHaveBeenCalled();
    expect(answer?.user.id).toBe('u1');
    expect(isCompanySuspended(store)).toBe(true);
  });

  it('keeps everything when the server cannot say', async () => {
    const store = keptStore();
    const wipe = vi.fn(() => Promise.resolve());
    await settleSession({ kind: 'none' }, store, wipe, () =>
      Promise.resolve('unknown'),
    );
    expect(wipe).not.toHaveBeenCalled();
    expect(store.getItem(SESSION_KEY)).not.toBeNull();
  });

  it('empties itself once the account is gone: a deleted company', async () => {
    const store = keptStore();
    markCompanySuspended(store, 'u1');
    const wipe = vi.fn(() => Promise.resolve());
    await expect(
      settleSession({ kind: 'none' }, store, wipe, () =>
        Promise.resolve('gone'),
      ),
    ).resolves.toBeNull();
    expect(wipe).toHaveBeenCalledOnce();
  });

  it('keeps the proofs when reactivated with its session run out, and asks to sign in', async () => {
    const store = keptStore();
    markCompanySuspended(store, 'u1');
    const wipe = vi.fn(() => Promise.resolve());
    await expect(
      settleSession({ kind: 'none' }, store, wipe, active),
    ).resolves.toBeNull();
    expect(wipe).not.toHaveBeenCalled();
    expect(isCompanySuspended(store)).toBe(true);

    await settleSession({ kind: 'session', session }, store, wipe, active);
    expect(wipe).not.toHaveBeenCalled();
  });

  it('empties itself when another account signs in', async () => {
    const store = memoryStore();
    markCompanySuspended(store, 'someone-else');
    const wipe = vi.fn(() => Promise.resolve());
    await settleSession({ kind: 'session', session }, store, wipe, active);
    expect(wipe).toHaveBeenCalledOnce();
  });
});
