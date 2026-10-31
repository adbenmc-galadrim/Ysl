import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import {
  OPERATING_PROFILE_KEY,
  PROFILE_MODELS,
  PROFILE_OF_MODEL,
  type OperatingProfile,
} from '@repo/contract/operating-profile';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { logger } from '@repo/shared/logger';
import { and, eq, sql } from 'drizzle-orm';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({
  db,
  pingDb: vi.fn(),
  withConnection: (work: (conn: typeof db) => Promise<unknown>) => work(db),
}));
vi.mock('@repo/auth', () => ({
  auth: { api: {} },
  isAPIError: () => false,
}));

const { callerFor, codeOf, sessionFor } = await import('./helpers/caller');
const {
  AGENT_ID,
  asAnyDb,
  OTHER_ORGANIZATION_ID,
  ORGANIZATION_ID,
  parcelRow,
  STRANGER_ID,
} = await import('./helpers/pglite');
const { logoFile } = await import('#features/company/logo');
const { companyTablesInOrder, purgeCompanyRows, releaseCompanyDomain } =
  await import('#features/platform/purge-company');

const PLATFORM_ID = 'platform-1';

function sessionOf(role: string | null, userId: string): Session {
  const base = sessionFor(role);
  return {
    session: { ...base.session, userId },
    user: { ...base.user, id: userId },
  };
}

const platform = () => callerFor(sessionOf('platform_admin', PLATFORM_ID));

type Rows<Row> = { rows: Row[] };

async function tablesWithOrganizationId(): Promise<string[]> {
  const result = (await db.execute(sql`
    select table_name as name from information_schema.columns
     where table_schema = 'public' and column_name = 'organization_id'
  `)) as unknown as Rows<{ name: string }>;
  return result.rows.map((row) => row.name);
}

async function rowsLeft(
  organizationId: string,
): Promise<Record<string, number>> {
  const left: Record<string, number> = {};
  for (const table of await tablesWithOrganizationId()) {
    const result = (await db.execute(
      sql`select count(*)::int as n from ${sql.identifier(table)} where organization_id = ${organizationId}`,
    )) as unknown as Rows<{ n: number }>;
    const n = result.rows[0]?.n ?? 0;
    if (n > 0) left[table] = n;
  }
  return left;
}

/** A row in every table a company can fill, so an empty purge would not pass. */
async function seedEverything(organizationId: string, userId: string) {
  const departmentId = newId();
  await db.insert(schema.department).values({
    id: departmentId,
    organizationId,
    name: 'Studio',
  });
  await db
    .insert(schema.departmentMember)
    .values({ userId, organizationId, departmentId });
  const personId = newId();
  await db.insert(schema.directoryPerson).values({
    id: personId,
    organizationId,
    lastName: 'Salarié',
    firstName: 'Nora',
    nameNorm: 'salarie nora',
    email: `nora-${organizationId}@example.test`,
    departmentId,
  });
  const contactId = newId();
  await db.insert(schema.contact).values({
    id: contactId,
    organizationId,
    name: 'Prestataire',
    nameNorm: 'prestataire',
    createdBy: userId,
  });
  const batchId = newId();
  await db.insert(schema.batch).values({
    id: batchId,
    organizationId,
    agentId: userId,
    startedAt: new Date(),
  });
  const parcel = {
    ...parcelRow(organizationId),
    receivedBy: userId,
    batchId,
    personId,
  };
  await db.insert(schema.parcel).values(parcel);
  await db.insert(schema.event).values({
    id: newId(),
    organizationId,
    entity: 'parcel',
    entityId: parcel.id,
    type: 'recu',
    at: new Date(),
    actorId: userId,
  });
  const notificationId = newId();
  await db.insert(schema.notification).values({
    id: notificationId,
    organizationId,
    type: 'avis',
    personId,
    recipients: ['nora@example.test'],
    parcelIds: [parcel.id],
    preparedAt: new Date(),
    preparedBy: userId,
  });
  await db.insert(schema.emailTemplate).values({
    id: newId(),
    organizationId,
    type: 'avis',
    name: 'Avis',
    subject: 'Colis',
    body: 'Bonjour',
    ownerId: userId,
  });
  await db.insert(schema.emailOutbox).values({
    idempotencyKey: `key-${organizationId}`,
    organizationId,
    notificationId,
    recipient: 'nora@example.test',
    subject: 'Colis',
    textBody: 'Bonjour',
  });
  await db.insert(schema.emailSuppression).values({
    organizationId,
    email: 'parti@example.test',
    reason: 'complained',
    at: new Date(),
  });
  await db.insert(schema.mailSender).values({
    organizationId,
    name: 'Courrier',
    email: `courrier@${organizationId}.example.test`,
    domain: `${organizationId}.example.test`,
    declared: true,
  });
  await db.insert(schema.sender).values({
    id: newId(),
    organizationId,
    displayName: 'Amazon',
    nameNorm: 'amazon',
  });
  await db.insert(schema.setting).values({
    id: newId(),
    organizationId,
    key: 'pickup',
    value: {},
  });
  await db.insert(schema.companyLogo).values({
    organizationId,
    contentType: 'image/png',
    bytes: Buffer.from([0x89, 0x50]),
    width: 64,
    height: 64,
  });
  await db.insert(schema.purgeRun).values({
    organizationId,
    trigger: 'auto',
    startedAt: new Date(),
  });
  await db.insert(schema.syncOp).values({
    organizationId,
    opId: newId(),
    userId,
    entity: 'parcel',
    entityId: parcel.id,
    status: 200,
  });
}

beforeAll(async () => {
  await db.insert(schema.user).values({
    id: PLATFORM_ID,
    name: 'Admin app',
    email: 'plateforme@example.test',
    role: 'platform_admin',
  });
});

afterAll(async () => {
  await client.close();
});

describe('the back-office', () => {
  it('shows names of companies and figures, nothing nominative', async () => {
    await db.insert(schema.department).values({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      name: 'Visible',
    });
    const companies = await platform().platform.companies();
    const company = companies.find((row) => row.id === ORGANIZATION_ID);
    expect(company).toMatchObject({
      name: 'Service courrier',
      accounts: 1,
      departments: 1,
      suspendedAt: null,
    });
    expect(JSON.stringify(companies)).not.toContain('agent@example.test');
    expect(JSON.stringify(companies)).not.toContain('Agent');
  });

  it('creates a company whose shuttle gets the profile of its model', async () => {
    const { id } = await platform().platform.createCompany({
      name: '  Atelier Lumen ',
      profileModel: 'multi_departments',
    });
    const record = await platform().platform.company({ id });
    expect(record).toMatchObject({
      name: 'Atelier Lumen',
      profileModel: 'multi_departments',
      departments: 1,
      accounts: 0,
      parcels: 0,
    });
    const [profile] = await db
      .select({ value: schema.setting.value })
      .from(schema.setting)
      .where(
        and(
          eq(schema.setting.organizationId, id),
          eq(schema.setting.key, OPERATING_PROFILE_KEY),
        ),
      );
    expect(profile?.value).toMatchObject({ shuttleActsAsDepartment: false });
  });

  const savedProfile = async (id: string) => {
    const rows = await db
      .select({ value: schema.setting.value })
      .from(schema.setting)
      .where(
        and(
          eq(schema.setting.organizationId, id),
          eq(schema.setting.key, OPERATING_PROFILE_KEY),
        ),
      );
    expect(rows).toHaveLength(1);
    return rows[0]?.value;
  };

  it.each(PROFILE_MODELS)('writes the whole profile of %s', async (model) => {
    const { id } = await platform().platform.createCompany({
      name: `Modèle ${model}`,
      profileModel: model,
    });
    expect(await savedProfile(id)).toEqual(PROFILE_OF_MODEL[model]);
  });

  it('writes the model as adjusted, and keeps the model it started from', async () => {
    const profile = {
      ...PROFILE_OF_MODEL.multi_departments,
      signature: 'required' as const,
    };
    const { id } = await platform().platform.createCompany({
      name: 'Ajustée',
      profileModel: 'multi_departments',
      profile,
    });
    expect(await savedProfile(id)).toEqual(profile);
    expect(await platform().platform.company({ id })).toMatchObject({
      profileModel: 'multi_departments',
      changedSteps: 1,
    });
  });

  it('counts no changed step for a company without a model', async () => {
    const { id } = await platform().platform.createCompany({
      name: 'Sans modèle',
      profileModel: 'small_site',
    });
    await db
      .update(schema.organization)
      .set({ profileModel: null })
      .where(eq(schema.organization.id, id));
    expect(await platform().platform.company({ id })).toMatchObject({
      profileModel: null,
      changedSteps: null,
    });
  });

  it('creates nothing from a partial profile', async () => {
    const partial = { ...PROFILE_OF_MODEL.small_site, signature: undefined };
    await expect(
      platform().platform.createCompany({
        name: 'Partielle',
        profileModel: 'small_site',
        profile: partial as unknown as OperatingProfile,
      }),
    ).rejects.toThrow();
    const companies = await platform().platform.companies();
    expect(companies.map((company) => company.name)).not.toContain('Partielle');
  });

  it('refuses a second company of the same name, whatever its case', async () => {
    expect(
      await codeOf(
        platform().platform.createCompany({
          name: 'atelier lumen',
          profileModel: 'small_site',
        }),
      ),
    ).toBe('CONFLICT');
  });

  it('renames, and refuses the name of another', async () => {
    const { id } = await platform().platform.createCompany({
      name: 'Avant',
      profileModel: 'small_site',
    });
    await platform().platform.renameCompany({ id, name: 'Après' });
    expect((await platform().platform.company({ id })).name).toBe('Après');
    expect(
      await codeOf(
        platform().platform.renameCompany({ id, name: 'Atelier Lumen' }),
      ),
    ).toBe('CONFLICT');
    await platform().platform.renameCompany({ id, name: 'Après' });
  });

  it.each(['company_admin', 'department', 'shuttle', 'agent', null])(
    'refuses the role %s',
    async (role) => {
      const caller = callerFor(sessionOf(role, AGENT_ID));
      expect(await codeOf(caller.platform.companies())).toBe('FORBIDDEN');
      expect(
        await codeOf(
          caller.platform.deleteCompany({
            id: ORGANIZATION_ID,
            confirmName: 'Service courrier',
          }),
        ),
      ).toBe('FORBIDDEN');
    },
  );
});

describe('a suspended company', () => {
  const shuttle = () => callerFor(sessionOf('shuttle', AGENT_ID));
  const reasonOf = async (run: Promise<unknown>) => {
    try {
      await run;
      return null;
    } catch (error) {
      return error as { code: string; cause?: unknown };
    }
  };

  it('stops every call of its accounts with a 403, never a 401', async () => {
    await platform().platform.suspendCompany({ id: ORGANIZATION_ID });
    const refused = await reasonOf(
      shuttle().sync.pull({ cursors: {} } as never),
    );
    expect(refused?.code).toBe('FORBIDDEN');
    expect(refused?.cause).toBeInstanceOf(Error);
    expect(await codeOf(shuttle().account.company())).toBe('FORBIDDEN');
    expect(
      await callerFor(null).platform.accountSuspension({ userId: AGENT_ID }),
    ).toEqual({ standing: 'suspended', reactivatedAt: null });
  });

  it('touches no other company', async () => {
    const other = callerFor(sessionOf('shuttle', STRANGER_ID));
    expect(await other.account.company()).toMatchObject({
      name: 'Autre client',
    });
    expect(
      await callerFor(null).platform.accountSuspension({ userId: STRANGER_ID }),
    ).toEqual({ standing: 'active', reactivatedAt: null });
  });

  it('keeps the first date when asked twice', async () => {
    const before = await platform().platform.company({ id: ORGANIZATION_ID });
    await platform().platform.suspendCompany({ id: ORGANIZATION_ID });
    const after = await platform().platform.company({ id: ORGANIZATION_ID });
    expect(after.suspendedAt).toEqual(before.suspendedAt);
  });

  it('works again once reactivated', async () => {
    await platform().platform.reactivateCompany({ id: ORGANIZATION_ID });
    const { reactivatedAt } = await callerFor(null).platform.accountSuspension({
      userId: AGENT_ID,
    });
    expect(reactivatedAt).toBeInstanceOf(Date);
    await platform().platform.reactivateCompany({ id: ORGANIZATION_ID });
    expect(
      (await callerFor(null).platform.accountSuspension({ userId: AGENT_ID }))
        .reactivatedAt,
    ).toEqual(reactivatedAt);
    expect(await shuttle().account.company()).toMatchObject({
      name: 'Service courrier',
    });
  });
});

describe('deleting a company', () => {
  it('does nothing unless the name is typed exactly', async () => {
    expect(
      await codeOf(
        platform().platform.deleteCompany({
          id: ORGANIZATION_ID,
          confirmName: 'Service',
        }),
      ),
    ).toBe('BAD_REQUEST');
    expect(await rowsLeft(ORGANIZATION_ID)).toHaveProperty(
      'organization_member',
    );
  });

  it('orders every company table, and classes every other one', async () => {
    const ordered = await companyTablesInOrder(db);
    expect(new Set(ordered)).toEqual(new Set(await tablesWithOrganizationId()));

    // A new table with no `organization_id` holds company data out of the
    // purge's reach, unless it cascades from one: decide, then add it here.
    const result = (await db.execute(sql`
      select t.table_name as name from information_schema.tables t
       where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
         and not exists (
           select 1 from information_schema.columns c
            where c.table_schema = 'public' and c.table_name = t.table_name
              and c.column_name = 'organization_id')
       order by 1
    `)) as unknown as Rows<{ name: string }>;
    expect(result.rows.map((row) => row.name)).toEqual([
      'account',
      'organization',
      'rate_limit',
      'session',
      'sync_generation',
      'user',
      'verification',
    ]);
  });

  it('leaves no row in any table, and the other company whole', async () => {
    await seedEverything(ORGANIZATION_ID, AGENT_ID);
    await seedEverything(OTHER_ORGANIZATION_ID, STRANGER_ID);
    await db.insert(schema.verification).values({
      id: 'reset-1',
      identifier: 'reset-password:token',
      value: AGENT_ID,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db.insert(schema.session).values({
      id: 'session-gone',
      token: 'gone',
      userId: AGENT_ID,
      expiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    });
    const otherBefore = await rowsLeft(OTHER_ORGANIZATION_ID);
    const logos = await db.select().from(schema.companyLogo);
    const logoOf = (organizationId: string) =>
      logos.find((logo) => logo.organizationId === organizationId)!.id;
    expect(Object.keys(await rowsLeft(ORGANIZATION_ID)).length).toBeGreaterThan(
      15,
    );

    await platform().platform.deleteCompany({
      id: ORGANIZATION_ID,
      confirmName: 'Service courrier',
    });

    expect(await rowsLeft(ORGANIZATION_ID)).toEqual({});
    expect(await rowsLeft(OTHER_ORGANIZATION_ID)).toEqual(otherBefore);
    // Its public address answers nothing any more; the other company's still does.
    expect(await logoFile(asAnyDb(db), logoOf(ORGANIZATION_ID))).toBeNull();
    expect(
      await logoFile(asAnyDb(db), logoOf(OTHER_ORGANIZATION_ID)),
    ).not.toBeNull();
    expect(
      await db
        .select()
        .from(schema.organization)
        .where(eq(schema.organization.id, ORGANIZATION_ID)),
    ).toEqual([]);
    expect(
      await db.select().from(schema.user).where(eq(schema.user.id, AGENT_ID)),
    ).toEqual([]);
    expect(await db.select().from(schema.session)).toEqual([]);
    expect(await db.select().from(schema.verification)).toEqual([]);
    expect(
      await callerFor(null).platform.accountSuspension({ userId: AGENT_ID }),
    ).toEqual({ standing: 'gone', reactivatedAt: null });
    expect(
      await codeOf(platform().platform.company({ id: ORGANIZATION_ID })),
    ).toBe('NOT_FOUND');
  });

  it('reaches a table added later', async () => {
    const id = newId();
    await db.insert(schema.organization).values({ id, name: 'Future' });
    await db.execute(
      sql`create table future_thing (organization_id uuid not null references organization(id))`,
    );
    await db.execute(sql`insert into future_thing values (${id})`);
    await purgeCompanyRows(db, id);
    const result = (await db.execute(
      sql`select count(*)::int as n from future_thing`,
    )) as unknown as Rows<{ n: number }>;
    expect(result.rows[0]?.n).toBe(0);
    await db.execute(sql`drop table future_thing`);
  });
});

describe('the mail domain of a deleted company', () => {
  const ours = { domain: 'a.test', declared: true, status: 'pending' };
  const provider = () => ({
    register: vi.fn(),
    check: vi.fn(),
    remove: vi.fn(() => Promise.resolve()),
  });

  it('is removed at the provider when the company declared it', async () => {
    const mails = provider();
    await releaseCompanyDomain(ours, mails);
    expect(mails.remove).toHaveBeenCalledWith('a.test');
  });

  it('stays when another company could own it at the shared account', async () => {
    const mails = provider();
    await releaseCompanyDomain(
      { domain: 'a.test', declared: false, status: 'pending' },
      mails,
    );
    expect(mails.remove).not.toHaveBeenCalled();
  });

  it('never fails the deletion, with no key or a provider down', async () => {
    const info = vi.spyOn(logger, 'info');
    await releaseCompanyDomain(ours, null);
    expect(info).toHaveBeenCalledWith(
      { domain: 'a.test' },
      expect.stringContaining('no key'),
    );
    const down = provider();
    down.remove.mockRejectedValueOnce(new Error('down'));
    await expect(releaseCompanyDomain(ours, down)).resolves.toBeUndefined();
  });
});
