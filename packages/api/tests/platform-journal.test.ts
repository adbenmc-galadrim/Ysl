import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq, sql } from 'drizzle-orm';

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
const { asAnyDb, ORGANIZATION_ID, parcelRow } =
  await import('./helpers/pglite');
const { readJournal } = await import('#features/platform/journal');
const { runPurge } = await import('#features/maintenance/purge');

const PLATFORM_ID = 'platform-1';

function platformSession(): Session {
  const base = sessionFor('platform_admin');
  return {
    session: { ...base.session, userId: PLATFORM_ID },
    user: { ...base.user, id: PLATFORM_ID, name: 'Sam Lefort' },
  };
}

const platform = () => callerFor(platformSession());

async function lines(companyId: string) {
  const { entries } = await readJournal(asAnyDb(db), { companyId });
  return entries.map((entry) => entry.action);
}

async function newCompany(name = `Client ${newId()}`) {
  const { id } = await platform().platform.createCompany({
    name,
    profileModel: 'small_site',
  });
  return { id, name };
}

beforeEach(async () => {
  await db.delete(schema.platformJournal);
});

await db.insert(schema.user).values({
  id: PLATFORM_ID,
  name: 'Sam Lefort',
  email: 'plateforme@example.test',
  role: 'platform_admin',
});

afterAll(async () => {
  await client.close();
});

describe('each back-office action', () => {
  it('writes its one line, by the platform account', async () => {
    const { id, name } = await newCompany();
    await platform().platform.renameCompany({ id, name: `${name} bis` });
    await platform().platform.suspendCompany({ id });
    await platform().platform.reactivateCompany({ id });
    const { entries } = await readJournal(asAnyDb(db), { companyId: id });
    expect(entries.map((entry) => entry.action).sort()).toEqual([
      'company_created',
      'company_reactivated',
      'company_renamed',
      'company_suspended',
    ]);
    for (const entry of entries) expect(entry.actorName).toBe('Sam Lefort');
    expect(
      entries.find((entry) => entry.action === 'company_renamed'),
    ).toMatchObject({ companyName: `${name} bis`, detail: { previousName: name } });
    expect(
      entries.find((entry) => entry.action === 'company_created')?.detail,
    ).toEqual({ profileModel: 'small_site' });
  });

  it('writes nothing for what did not happen', async () => {
    const { id, name } = await newCompany();
    await platform().platform.reactivateCompany({ id });
    await platform().platform.renameCompany({ id, name });
    await platform().platform.suspendCompany({ id });
    await platform().platform.suspendCompany({ id });
    expect(await lines(id)).toEqual(['company_suspended', 'company_created']);
  });

  it('does not act when the journal cannot write', async () => {
    const { id, name } = await newCompany();
    await db.execute(
      sql`alter table platform_journal rename to platform_journal_away`,
    );
    try {
      expect(
        await codeOf(platform().platform.suspendCompany({ id })),
      ).toBeDefined();
      expect(
        await codeOf(
          platform().platform.deleteCompany({ id, confirmName: name }),
        ),
      ).toBeDefined();
    } finally {
      await db.execute(
        sql`alter table platform_journal_away rename to platform_journal`,
      );
    }
    const [row] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, id));
    expect(row?.suspendedAt).toBeNull();
  });
});

describe('a deleted company', () => {
  it('keeps its lines, with figures and without its people', async () => {
    const { id, name } = await newCompany();
    const person = {
      id: `member-${id}`,
      name: 'Claire Bonnet',
      email: `claire-${id}@example.test`,
      role: 'company_admin',
    };
    await db.insert(schema.user).values(person);
    await db
      .insert(schema.organizationMember)
      .values({ userId: person.id, organizationId: id });
    await db.insert(schema.parcel).values({
      ...parcelRow(id),
      receivedBy: person.id,
    });
    await platform().platform.deleteCompany({ id, confirmName: name });

    const rows = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, id));
    expect(rows).toEqual([]);

    const { entries } = await readJournal(asAnyDb(db), { companyId: id });
    expect(entries.map((entry) => entry.action)).toEqual([
      'company_deleted',
      'company_created',
    ]);
    expect(entries[0]).toMatchObject({
      companyName: name,
      detail: { accounts: 1, departments: 1, parcels: 1 },
    });
    const written = JSON.stringify(entries);
    expect(written).not.toContain('Claire');
    expect(written).not.toContain('@example.test');
  });
});

describe('an invitation', () => {
  const invite = (organizationId: string, email: string) =>
    platform().invitations.inviteCompanyAdmin({
      organizationId,
      name: 'Claire Bonnet',
      email,
      copy: true,
    });

  it('names neither the person nor the address', async () => {
    const { id } = await newCompany();
    await invite(id, `claire-${id}@example.test`);
    const { entries } = await readJournal(asAnyDb(db), { companyId: id });
    expect(entries[0]?.action).toBe('company_admin_invited');
    expect(JSON.stringify(entries)).not.toContain('Claire');
    expect(JSON.stringify(entries)).not.toContain('@example.test');
  });

  it('leaves a trace of an address found taken, without the address', async () => {
    const { id } = await newCompany();
    expect(await codeOf(invite(id, 'agent@example.test'))).toBe('CONFLICT');
    const { entries } = await readJournal(asAnyDb(db), { companyId: id });
    expect(entries[0]?.action).toBe('company_admin_invite_refused');
    expect(JSON.stringify(entries)).not.toContain('agent@example.test');
  });
});

describe('reading the journal', () => {
  const NOW = new Date('2026-10-31T12:00:00Z');
  const row = (
    companyName: string,
    at: string,
    action: 'company_created' | 'company_suspended' = 'company_created',
  ) => ({
    action,
    companyId: ORGANIZATION_ID,
    companyName,
    actorId: PLATFORM_ID,
    actorName: 'Sam Lefort',
    at: new Date(at),
  });

  it('filters by type, period and a part of the name, newest first', async () => {
    await db.insert(schema.platformJournal).values([
      row('Atelier Lumen', '2026-10-30T10:00:00Z'),
      row('Atelier Lumen', '2026-10-29T10:00:00Z', 'company_suspended'),
      row('100%_Bio', '2026-07-01T10:00:00Z'),
    ]);
    const read = async (input: Parameters<typeof readJournal>[1]) =>
      (await readJournal(asAnyDb(db), input, NOW)).entries.map((e) => e.at);

    expect(await read({})).toEqual([
      new Date('2026-10-30T10:00:00Z'),
      new Date('2026-10-29T10:00:00Z'),
      new Date('2026-07-01T10:00:00Z'),
    ]);
    expect(await read({ period: '30d' })).toHaveLength(2);
    expect(await read({ action: 'company_suspended' })).toEqual([
      new Date('2026-10-29T10:00:00Z'),
    ]);
    expect(await read({ query: 'lumen' })).toHaveLength(2);
    expect(await read({ query: '%' })).toHaveLength(1);
    expect(await read({ query: 'x_' })).toHaveLength(0);
  });

  it('pages, with the total of everything that matches', async () => {
    await db
      .insert(schema.platformJournal)
      .values(
        Array.from({ length: 5 }, (_, i) =>
          row('Atelier', `2026-10-0${i + 1}T10:00:00Z`),
        ),
      );
    const page = await readJournal(
      asAnyDb(db),
      { offset: 2, limit: 2 },
      NOW,
    );
    expect(page.total).toBe(5);
    expect(page.entries.map((entry) => entry.at)).toEqual([
      new Date('2026-10-03T10:00:00Z'),
      new Date('2026-10-02T10:00:00Z'),
    ]);
  });

  it('forgets what is older than twelve months', async () => {
    await db
      .insert(schema.platformJournal)
      .values([
        row('Ancienne', '2025-10-30T10:00:00Z'),
        row('Récente', '2025-11-01T10:00:00Z'),
      ]);
    await runPurge(asAnyDb(db), { now: NOW, trigger: 'auto' });
    const { entries } = await readJournal(asAnyDb(db), {}, NOW);
    expect(entries.map((entry) => entry.companyName)).toEqual(['Récente']);
  });
});
