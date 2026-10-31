import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import * as schema from '@repo/db/schema';
import { credentialRow } from '@repo/auth/password';
import { eq } from 'drizzle-orm';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({
  db,
  pingDb: vi.fn(),
  withConnection: (work: (conn: typeof db) => Promise<unknown>) => work(db),
}));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));

const { callerFor, codeOf, sessionFor } = await import('./helpers/caller');
const { ORGANIZATION_ID, OTHER_ORGANIZATION_ID } = await import(
  './helpers/pglite'
);
const { newId } = await import('@repo/shared/id');

const ADMIN = 'admin-1';
const SECOND_ADMIN = 'admin-2';
const SHUTTLE = 'shuttle-1';
const FOREIGN = 'foreign-1';
const PLATFORM = 'platform-1';
const STUDIO = newId();
const FINANCE = newId();
const OTHER_DEPARTMENT = newId();

function sessionOf(
  userId: string,
  role: string,
  banned = false,
): Session {
  const base = sessionFor(role);
  return {
    session: { ...base.session, userId, id: `session-${userId}` },
    user: { ...base.user, id: userId, banned },
  };
}

const admin = () => callerFor(sessionOf(ADMIN, 'company_admin'));

async function userRow(id: string) {
  const [row] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, id));
  return row;
}

const sessionsOf = (id: string) =>
  db.select().from(schema.session).where(eq(schema.session.userId, id));

async function openSession(userId: string) {
  await db.insert(schema.session).values({
    id: newId(),
    token: newId(),
    userId,
    expiresAt: new Date('2099-01-01'),
    updatedAt: new Date(),
    userAgent: 'iPhone',
  });
}

beforeAll(async () => {
  await db.insert(schema.department).values([
    { id: STUDIO, organizationId: ORGANIZATION_ID, name: 'Studio' },
    { id: FINANCE, organizationId: ORGANIZATION_ID, name: 'Finance' },
    { id: OTHER_DEPARTMENT, organizationId: OTHER_ORGANIZATION_ID, name: 'Ailleurs' },
  ]);
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.departmentMember);
  await db
    .delete(schema.user)
    .where(eq(schema.user.email, 'nouveau@example.test'));
  for (const id of [ADMIN, SECOND_ADMIN, SHUTTLE, FOREIGN, PLATFORM]) {
    await db.delete(schema.user).where(eq(schema.user.id, id));
  }
  await db.insert(schema.user).values([
    { id: ADMIN, name: 'Claire Admin', email: 'claire@example.test', role: 'company_admin' },
    { id: SECOND_ADMIN, name: 'Zoé Admin', email: 'zoe@example.test', role: 'company_admin', banned: true, banReason: 'suspended' },
    { id: SHUTTLE, name: 'Karim Navette', email: 'karim@example.test', role: 'shuttle' },
    { id: FOREIGN, name: 'Autre Société', email: 'autre-societe@example.test', role: 'shuttle' },
    { id: PLATFORM, name: 'Admin App', email: 'app@example.test', role: 'platform_admin' },
  ]);
  await db.insert(schema.organizationMember).values([
    { userId: ADMIN, organizationId: ORGANIZATION_ID },
    { userId: SECOND_ADMIN, organizationId: ORGANIZATION_ID },
    { userId: SHUTTLE, organizationId: ORGANIZATION_ID },
    { userId: FOREIGN, organizationId: OTHER_ORGANIZATION_ID },
  ]);
  await db
    .insert(schema.account)
    .values(
      await Promise.all(
        [ADMIN, SECOND_ADMIN, SHUTTLE, FOREIGN].map((id) =>
          credentialRow(id, 'mot-de-passe'),
        ),
      ),
    );
  await openSession(SHUTTLE);
});

afterAll(async () => {
  await client.close();
});

describe('who reaches the accounts', () => {
  it.each(['shuttle', 'department'])('refuses a %s', async (role) => {
    const caller = callerFor(sessionOf(SHUTTLE, role));
    expect(await codeOf(caller.accounts.list({}))).toBe('FORBIDDEN');
  });

  it('refuses every request of a suspended account, session or not', async () => {
    const caller = callerFor(sessionOf(ADMIN, 'company_admin', true));
    expect(await codeOf(caller.accounts.list({}))).toBe('FORBIDDEN');
    expect(await codeOf(caller.account.me())).toBe('FORBIDDEN');
  });
});

describe('the wall between companies', () => {
  it('lists neither another company nor the platform', async () => {
    const { rows, counts } = await admin().accounts.list({});
    const ids = rows.map((row) => row.id);
    expect(ids).toContain(SHUTTLE);
    expect(ids).not.toContain(FOREIGN);
    expect(ids).not.toContain(PLATFORM);
    expect(counts.all).toBeGreaterThanOrEqual(3);
  });

  it('keeps out an app admin attached to the company by mistake', async () => {
    await db
      .insert(schema.organizationMember)
      .values({ userId: PLATFORM, organizationId: ORGANIZATION_ID });
    const { rows } = await admin().accounts.list({ search: 'app@' });
    expect(rows).toEqual([]);
    expect(await codeOf(admin().accounts.suspend({ userId: PLATFORM }))).toBe('NOT_FOUND');
  });

  it.each([
    ['get', () => admin().accounts.get({ userId: FOREIGN })],
    ['suspend', () => admin().accounts.suspend({ userId: FOREIGN })],
    ['revoke', () => admin().accounts.revoke({ userId: FOREIGN })],
    ['reinstate', () => admin().accounts.reinstate({ userId: FOREIGN })],
    ['setRole', () => admin().accounts.setRole({ userId: FOREIGN, role: 'shuttle', departmentId: null })],
    ['resetPassword', () => admin().accounts.resetPassword({ userId: FOREIGN, password: 'nouveau-mdp' })],
  ])('answers 404 on %s for another company', async (_name, run) => {
    expect(await codeOf(run())).toBe('NOT_FOUND');
    expect((await userRow(FOREIGN))?.banned).toBeFalsy();
  });

  it('refuses a department of another company at creation and at role change', async () => {
    expect(
      await codeOf(
        admin().accounts.create({
          name: 'Nouveau',
          email: 'nouveau@example.test',
          role: 'department',
          departmentId: OTHER_DEPARTMENT,
        }),
      ),
    ).toBe('NOT_FOUND');
    expect(await userRow(SHUTTLE)).toBeDefined();
    const [created] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, 'nouveau@example.test'));
    expect(created).toBeUndefined();
    expect(
      await codeOf(
        admin().accounts.setRole({
          userId: SHUTTLE,
          role: 'department',
          departmentId: OTHER_DEPARTMENT,
        }),
      ),
    ).toBe('NOT_FOUND');
    expect((await userRow(SHUTTLE))?.role).toBe('shuttle');
  });
});

describe('creating an account', () => {
  it('attaches it to the company and its department, with no password to sign in with', async () => {
    const { account: created } = await admin().accounts.create({
      name: 'Nadia Kessler',
      email: 'Nouveau@Example.test',
      role: 'department',
      departmentId: STUDIO,
    });
    expect(created).toMatchObject({
      email: 'nouveau@example.test',
      role: 'department',
      departmentName: 'Studio',
      state: 'invited',
    });
    expect(created.linkExpiresAt).not.toBeNull();
    const credentials = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, created.id));
    expect(credentials).toHaveLength(0);
  });

  it('never hands out the platform role', async () => {
    expect(
      await codeOf(
        admin().accounts.create({
          name: 'X',
          email: 'nouveau@example.test',
          role: 'platform_admin' as 'shuttle',
          departmentId: null,
        }),
      ),
    ).toBe('BAD_REQUEST');
  });

  it('refuses a department account with no department', async () => {
    expect(
      await codeOf(
        admin().accounts.create({
          name: 'X',
          email: 'nouveau@example.test',
          role: 'department',
          departmentId: null,
        }),
      ),
    ).toBe('BAD_REQUEST');
  });

  it('answers a taken address, even of another company, with a conflict', async () => {
    expect(
      await codeOf(
        admin().accounts.create({
          name: 'X',
          email: 'autre-societe@example.test',
          role: 'shuttle',
          departmentId: null,
        }),
      ),
    ).toBe('CONFLICT');
  });
});

describe('more than 200 accounts', () => {
  it('reaches every one of them, each once', async () => {
    const ids = Array.from({ length: 205 }, (_, i) => `bulk-${i}`);
    await db.insert(schema.user).values(
      ids.map((id, i) => ({ id, name: 'Masse', email: `${id}-${i}@bulk.test`, role: 'shuttle' })),
    );
    await db
      .insert(schema.organizationMember)
      .values(ids.map((userId) => ({ userId, organizationId: ORGANIZATION_ID })));
    const seen: string[] = [];
    let page = 1;
    for (;;) {
      const result = await admin().accounts.list({ page, pageSize: 50, search: 'Masse' });
      expect(result.total).toBe(205);
      if (result.rows.length === 0) break;
      seen.push(...result.rows.map((row) => row.id));
      page += 1;
    }
    expect(seen).toHaveLength(205);
    expect(new Set(seen).size).toBe(205);
    for (const id of ids) {
      await db.delete(schema.user).where(eq(schema.user.id, id));
    }
  });

  it('takes % as a character in a search, not as a wildcard', async () => {
    const { rows } = await admin().accounts.list({ search: '%' });
    expect(rows).toEqual([]);
  });
});

describe('the last admin', () => {
  it.each(['suspend', 'revoke'] as const)('cannot %s themself', async (gesture) => {
    expect(await codeOf(admin().accounts[gesture]({ userId: ADMIN }))).toBe('CONFLICT');
    expect((await userRow(ADMIN))?.banned).toBeFalsy();
  });

  it('can step down once another admin is active', async () => {
    await admin().accounts.reinstate({ userId: SECOND_ADMIN });
    await admin().accounts.suspend({ userId: ADMIN });
    expect((await userRow(ADMIN))?.banned).toBe(true);
  });

  it('is not counted among the active by a suspended colleague', async () => {
    expect((await userRow(SECOND_ADMIN))?.banned).toBe(true);
    expect(await codeOf(admin().accounts.revoke({ userId: ADMIN }))).toBe('CONFLICT');
  });
});

describe('suspending and revoking', () => {
  it('a suspension keeps the sessions, so the phone keeps its data', async () => {
    await admin().accounts.suspend({ userId: SHUTTLE });
    expect(await userRow(SHUTTLE)).toMatchObject({ banned: true, banReason: 'suspended' });
    expect(await sessionsOf(SHUTTLE)).toHaveLength(1);
    await admin().accounts.reinstate({ userId: SHUTTLE });
    expect(await userRow(SHUTTLE)).toMatchObject({ banned: false, banReason: null });
    expect(await sessionsOf(SHUTTLE)).toHaveLength(1);
  });

  it('a revocation closes the sessions and frees the department', async () => {
    await db.insert(schema.departmentMember).values({
      userId: SHUTTLE,
      organizationId: ORGANIZATION_ID,
      departmentId: STUDIO,
    });
    await admin().accounts.revoke({ userId: SHUTTLE });
    expect(await userRow(SHUTTLE)).toMatchObject({ banned: true, banReason: 'revoked' });
    expect(await sessionsOf(SHUTTLE)).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.departmentMember)
        .where(eq(schema.departmentMember.userId, SHUTTLE)),
    ).toEqual([]);
  });

  it('does not turn a revocation back into a suspension', async () => {
    await admin().accounts.revoke({ userId: SHUTTLE });
    await admin().accounts.suspend({ userId: SHUTTLE });
    expect((await userRow(SHUTTLE))?.banReason).toBe('revoked');
  });

  it('brings a revoked account back only with a new password', async () => {
    await admin().accounts.revoke({ userId: SHUTTLE });
    expect(await codeOf(admin().accounts.reinstate({ userId: SHUTTLE }))).toBe('BAD_REQUEST');
    await admin().accounts.reinstate({ userId: SHUTTLE, password: 'nouveau-mdp' });
    expect((await userRow(SHUTTLE))?.banned).toBe(false);
  });

  it('keeps a revoked account out of departments, or none could be archived', async () => {
    await admin().accounts.revoke({ userId: SHUTTLE });
    expect(
      await codeOf(
        admin().accounts.setRole({ userId: SHUTTLE, role: 'department', departmentId: STUDIO }),
      ),
    ).toBe('BAD_REQUEST');
    expect(
      await codeOf(
        admin().departments.attachAccount({ userId: SHUTTLE, departmentId: STUDIO }),
      ),
    ).toBe('BAD_REQUEST');
  });

  it('filters by state', async () => {
    await admin().accounts.suspend({ userId: SHUTTLE });
    const suspended = await admin().accounts.list({ state: 'suspended' });
    expect(suspended.rows.map((row) => row.id)).toContain(SHUTTLE);
    const active = await admin().accounts.list({ state: 'active' });
    expect(active.rows.map((row) => row.id)).not.toContain(SHUTTLE);
  });
});

describe('the last admin', () => {
  it('is not replaced by an invitation nobody answered', async () => {
    await db.delete(schema.user).where(eq(schema.user.id, SECOND_ADMIN));
    await admin().accounts.create({
      name: 'Invitée',
      email: 'nouveau@example.test',
      role: 'company_admin',
      departmentId: null,
    });
    expect(await codeOf(admin().accounts.revoke({ userId: ADMIN }))).toBe('CONFLICT');
    expect(await codeOf(admin().accounts.suspend({ userId: ADMIN }))).toBe('CONFLICT');
  });
});

describe('the password', () => {
  it('keeps the sessions unless asked to close them', async () => {
    await admin().accounts.resetPassword({ userId: SHUTTLE, password: 'nouveau-mdp' });
    expect(await sessionsOf(SHUTTLE)).toHaveLength(1);
    await admin().accounts.resetPassword({
      userId: SHUTTLE,
      password: 'encore-nouveau',
      closeSessions: true,
    });
    expect(await sessionsOf(SHUTTLE)).toHaveLength(0);
  });

  it('asks for a change when an admin sets it, also on bringing back', async () => {
    expect((await userRow(SHUTTLE))?.passwordChangeRequiredAt).toBeNull();
    await admin().accounts.resetPassword({ userId: SHUTTLE, password: 'nouveau-mdp' });
    expect((await userRow(SHUTTLE))?.passwordChangeRequiredAt).toBeInstanceOf(Date);
    await db
      .update(schema.user)
      .set({ passwordChangeRequiredAt: null })
      .where(eq(schema.user.id, SHUTTLE));
    await admin().accounts.revoke({ userId: SHUTTLE });
    await admin().accounts.reinstate({ userId: SHUTTLE, password: 'nouveau-mdp' });
    expect((await userRow(SHUTTLE))?.passwordChangeRequiredAt).toBeInstanceOf(Date);
  });
});

describe('changing a role', () => {
  it('moves between shuttle and department, with the attachment', async () => {
    await admin().accounts.setRole({ userId: SHUTTLE, role: 'department', departmentId: FINANCE });
    let record = await admin().accounts.get({ userId: SHUTTLE });
    expect(record).toMatchObject({ role: 'department', departmentName: 'Finance' });
    await admin().accounts.setRole({ userId: SHUTTLE, role: 'shuttle', departmentId: null });
    record = await admin().accounts.get({ userId: SHUTTLE });
    expect(record).toMatchObject({ role: 'shuttle', departmentId: null });
  });

  it('leaves an admin an admin', async () => {
    expect(
      await codeOf(
        admin().accounts.setRole({ userId: SECOND_ADMIN, role: 'shuttle', departmentId: null }),
      ),
    ).toBe('BAD_REQUEST');
  });

  it('refuses promoting to admin through this route', async () => {
    expect(
      await codeOf(
        admin().accounts.setRole({
          userId: SHUTTLE,
          role: 'company_admin' as 'shuttle',
          departmentId: null,
        }),
      ),
    ).toBe('BAD_REQUEST');
  });
});
