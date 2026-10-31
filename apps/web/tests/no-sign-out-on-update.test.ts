import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Session } from '@repo/auth/client';
import { describe, expect, it, vi } from 'vitest';
import {
  readSessionAnswer,
  SESSION_KEY,
  settleSession,
} from '#/features/auth/session-cache';

/**
 * Signing a phone out erases its database, its photos and its handover
 * proofs, the only copy. No update may lead there: not the new build reading
 * what an old one kept, not a server answering oddly during a deployment.
 */
const SRC = new URL('../src', import.meta.url).pathname;

const sessionOf = (role: unknown) =>
  ({
    user: { id: 'u1', name: 'Karim', email: 'k@example.com', role },
    session: { id: 's1', userId: 'u1' },
  }) as unknown as Session;

function keptBy(role: unknown) {
  const data = new Map([[SESSION_KEY, JSON.stringify(sessionOf(role))]]);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const ROLES_EVER_KEPT = [
  'agent',
  'admin',
  'shuttle',
  'company_admin',
  'department',
  'a-role-of-tomorrow',
  null,
  undefined,
];

const NOT_A_VERDICT = [
  { name: 'network down', answer: { error: { status: 0 } } },
  { name: 'proxy 403', answer: { error: { status: 403 } } },
  { name: 'proxy 404', answer: { error: { status: 404 } } },
  { name: 'gateway 502', answer: { error: { status: 502 } } },
  { name: 'gateway 503', answer: { error: { status: 503 } } },
  { name: 'server 500', answer: { error: { status: 500 } } },
  { name: 'page of a proxy, in 200', answer: { data: '<html>…</html>' } },
  { name: 'object that is no session', answer: { data: { status: 'ok' } } },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const active = () => Promise.resolve('active' as const);

describe('an update never signs a device out', () => {
  it.each(ROLES_EVER_KEPT)(
    'keeps the session and the data of a device that kept the role %s, offline',
    async (role) => {
      const store = keptBy(role);
      const wipe = vi.fn(() => Promise.resolve());
      const session = await settleSession(
        { kind: 'unreachable' },
        store,
        wipe,
        active,
      );
      expect(wipe).not.toHaveBeenCalled();
      expect(session?.user.id).toBe('u1');
      expect(store.data.has(SESSION_KEY)).toBe(true);
    },
  );

  it.each(ROLES_EVER_KEPT)(
    'keeps the data when the server now calls the same account %s',
    async (role) => {
      const wipe = vi.fn(() => Promise.resolve());
      await settleSession(
        { kind: 'session', session: sessionOf(role) },
        keptBy('agent'),
        wipe,
        active,
      );
      expect(wipe).not.toHaveBeenCalled();
    },
  );

  it.each(NOT_A_VERDICT)(
    'takes $name during a deployment for an unreachable server',
    async ({ answer }) => {
      const store = keptBy('shuttle');
      const wipe = vi.fn(() => Promise.resolve());
      const lookup = readSessionAnswer(answer);
      expect(lookup).toEqual({ kind: 'unreachable' });
      await settleSession(lookup, store, wipe, active);
      expect(wipe).not.toHaveBeenCalled();
      expect(store.data.has(SESSION_KEY)).toBe(true);
    },
  );

  it('only empties the device on the auth server saying the session ended', () => {
    expect(readSessionAnswer({ data: null, error: null })).toEqual({
      kind: 'none',
    });
    expect(readSessionAnswer({ error: { status: 401 } })).toEqual({
      kind: 'none',
    });
  });

  it('keeps a session whatever role it names', () => {
    expect(readSessionAnswer({ data: sessionOf('new-role') }).kind).toBe(
      'session',
    );
  });

  it('has the wipe called from the sign-out and the ended session only', () => {
    const callers = sourceFiles(SRC)
      .filter((path) => /\.tsx?$/.test(path))
      .filter((path) => /\bwipeLocalData\b/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(SRC.length + 1))
      .sort();
    expect(callers).toEqual([
      'features/auth/api/session.ts',
      'features/auth/api/sign-out.ts',
      'features/auth/wipe.ts',
    ]);
  });

  it('leaves the local data out of what the updater touches', () => {
    const updater = readFileSync(
      join(SRC, 'features/update/updater.ts'),
      'utf8',
    );
    expect(updater).not.toMatch(/localStorage|indexedDB|\bdb\b|signOut/);
  });
});
