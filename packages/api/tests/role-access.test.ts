import { DEFAULT_OPERATING_PROFILE } from '@repo/contract/operating-profile';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import { EMPTY_PICKUP } from '@repo/contract/settings';
import { department, departmentMember } from '@repo/db/schema';
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
const { AGENT_ID, ORGANIZATION_ID } = await import('./helpers/pglite');

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
  'maintenance.purgeNow': (caller) => caller.maintenance.purgeNow(),
  'devices.revoke': (caller) => caller.devices.revoke({ id: newId() }),
  'agents.list': (caller) => caller.agents.list(),
  'agents.create': (caller) =>
    caller.agents.create({
      name: 'Test',
      email: 'test@example.com',
      password: 'motdepasse-1',
    }),
  'agents.setActive': (caller) =>
    caller.agents.setActive({ userId: 'x', active: false }),
  'agents.resetPassword': (caller) =>
    caller.agents.resetPassword({ userId: 'x', password: 'motdepasse-1' }),
  'operating.get': (caller) => caller.operating.get(),
  'operating.save': (caller) =>
    caller.operating.save({ profile: DEFAULT_OPERATING_PROFILE }),
  'departments.list': (caller) => caller.departments.list(),
  'departments.create': (caller) =>
    caller.departments.create({ name: 'Finance' }),
  'departments.update': (caller) =>
    caller.departments.update({
      id: newId(),
      name: 'Finance',
      receptionPoint: null,
    }),
  'departments.updatePickup': (caller) =>
    caller.departments.updatePickup({ id: newId(), pickup: EMPTY_PICKUP }),
  'departments.archive': (caller) =>
    caller.departments.archive({ id: newId() }),
  'departments.attachAccount': (caller) =>
    caller.departments.attachAccount({ userId: 'x', departmentId: null }),
  'account.company': (caller) => caller.account.company(),
  'directory.moveEffects': (caller) =>
    caller.directory.moveEffects({ personId: newId() }),
  'directory.move': (caller) =>
    caller.directory.move({ personId: newId(), departmentId: newId() }),
  'directory.previewImport': (caller) =>
    caller.directory.previewImport({ csv: 'nom,mail', choices: [] }),
  'directory.applyImport': (caller) =>
    caller.directory.applyImport({ csv: 'nom,mail', choices: [] }),
};

const WHOLE_COMPANY = [
  'sync.pull',
  'sync.push',
  'pickup.verify',
  'exports.parcelsCsv',
  'exports.selectionCsv',
];
const ADMIN = [
  'devices.list',
  'devices.revoke',
  'maintenance.status',
  'maintenance.purgeNow',
  'imports.v1Csv',
  'departments.create',
  'departments.update',
  'departments.updatePickup',
  'departments.archive',
  'departments.attachAccount',
  'operating.get',
  'operating.save',
  'directory.moveEffects',
  'directory.move',
  'directory.previewImport',
  'directory.applyImport',
];
const AGENTS = [
  'agents.list',
  'agents.create',
  'agents.setActive',
  'agents.resetPassword',
];
const READ_DEPARTMENTS = ['departments.list', 'account.company'];
const OPERATIONS = [...WHOLE_COMPANY, ...READ_DEPARTMENTS];
const WITHOUT_HANDOVER = OPERATIONS.filter(
  (route) => route !== 'pickup.verify',
);

const ALLOWED: Record<string, string[]> = {
  agent: OPERATIONS,
  none: OPERATIONS,
  admin: [...OPERATIONS, ...ADMIN, ...AGENTS],
  company_admin: [...WITHOUT_HANDOVER, ...ADMIN],
  shuttle: WITHOUT_HANDOVER,
  // Attached nowhere: the attached account has its own test below.
  department: READ_DEPARTMENTS,
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

describe('a department account attached to a department', () => {
  it.each(Object.keys(ROUTES))('on %s', async (route) => {
    const departmentId = newId();
    await db
      .insert(department)
      .values({
        id: departmentId,
        organizationId: ORGANIZATION_ID,
        name: route,
      });
    await db.insert(departmentMember).values({
      userId: AGENT_ID,
      organizationId: ORGANIZATION_ID,
      departmentId,
    });
    const code = await codeOf(
      ROUTES[route]!(callerFor(sessionOf('department'))),
    );
    await db.delete(departmentMember);
    if (OPERATIONS.includes(route)) {
      expect(code).not.toBe('FORBIDDEN');
    } else {
      expect(code).toBe('FORBIDDEN');
    }
  });
});
