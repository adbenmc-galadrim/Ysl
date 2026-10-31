import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import { newId } from '@repo/shared/id';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

const api = vi.hoisted(() => ({
  listUsers: vi.fn(() => Promise.resolve({ users: [] })),
}));

vi.mock('@repo/db', () => ({
  db,
  pingDb: vi.fn(),
  withConnection: (work: (conn: typeof db) => Promise<unknown>) => work(db),
}));
vi.mock('@repo/auth', () => ({ auth: { api }, isAPIError: () => false }));

const { callerFor, sessionFor } = await import('./helpers/caller');
const { AGENT_ID } = await import('./helpers/pglite');

afterAll(async () => {
  await client.close();
});

function sessionOf(role: string | null): Session {
  const base = sessionFor(role);
  return {
    session: { ...base.session, userId: AGENT_ID },
    user: { ...base.user, id: AGENT_ID },
  };
}

type Caller = ReturnType<typeof callerFor>;

const ROUTES: Record<string, (caller: Caller) => Promise<unknown>> = {
  'sync.pull': (caller) => caller.sync.pull({ cursor: null }),
  'sync.push': (caller) => caller.sync.push({ ops: [] }),
  'pickup.verify': (caller) =>
    caller.pickup.verify({ kind: 'pin', hash: 'a'.repeat(64) }),
  'exports.parcelsCsv': (caller) => caller.exports.parcelsCsv(),
  'exports.selectionCsv': (caller) =>
    caller.exports.selectionCsv({ parcelIds: [newId()] }),
  'devices.list': (caller) => caller.devices.list(),
  'maintenance.status': (caller) => caller.maintenance.status(),
  'imports.v1Csv': (caller) => caller.imports.v1Csv({ csv: '' }),
  'agents.list': (caller) => caller.agents.list(),
};

const WHOLE_COMPANY = [
  'sync.pull',
  'sync.push',
  'pickup.verify',
  'exports.parcelsCsv',
  'exports.selectionCsv',
];
const ADMIN = ['devices.list', 'maintenance.status', 'imports.v1Csv'];

const ALLOWED: Record<string, string[]> = {
  agent: WHOLE_COMPANY,
  none: WHOLE_COMPANY,
  admin: [...WHOLE_COMPANY, ...ADMIN, 'agents.list'],
  company_admin: [...WHOLE_COMPANY, ...ADMIN],
  shuttle: WHOLE_COMPANY,
  department: [],
  platform_admin: [],
};

async function codeOf(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe.each(Object.keys(ALLOWED))('role %s', (role) => {
  const allowed = ALLOWED[role] ?? [];

  it.each(Object.keys(ROUTES))('on %s', async (route) => {
    const caller = callerFor(sessionOf(role === 'none' ? null : role));
    const code = await codeOf(ROUTES[route]!(caller));
    if (allowed.includes(route)) {
      expect(code).not.toBe('FORBIDDEN');
    } else {
      expect(code).toBe('FORBIDDEN');
    }
  });
});
