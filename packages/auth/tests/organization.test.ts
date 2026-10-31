import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import {
  OPERATING_PROFILE_KEY,
  SMALL_SITE_OPERATING_PROFILE,
} from '@repo/contract/operating-profile';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AlreadyAttachedError,
  attachToOrganization,
  chooseOrganization,
  chooseOrganizationFor,
  createCompany,
  DEFAULT_ORGANIZATION_NAME,
  OrganizationChoiceError,
  PlatformAccountError,
  resolveOrganization,
  resolveOrganizationFor,
} from '#organization';

const migrationsFolder = fileURLToPath(
  new URL('../../db/drizzle', import.meta.url),
);

const client = new PGlite();
const db = drizzle({ client, schema });

beforeAll(async () => {
  await migrate(db, { migrationsFolder });
  await db.insert(schema.user).values([
    { id: 'u1', name: 'Un', email: 'un@example.test' },
    { id: 'u2', name: 'Deux', email: 'deux@example.test' },
    {
      id: 'app-admin',
      name: 'Admin app',
      email: 'plateforme@example.test',
      role: 'platform_admin',
    },
  ]);
});

beforeEach(async () => {
  await db.delete(schema.setting);
  await db.delete(schema.department);
  await db.delete(schema.organizationMember);
  await db.delete(schema.organization);
});

afterAll(async () => {
  await client.close();
});

describe('resolveOrganization', () => {
  it('creates the first organization of an empty database', async () => {
    const resolved = await resolveOrganization(db);

    expect(resolved).toMatchObject({
      name: DEFAULT_ORGANIZATION_NAME,
      created: true,
    });
    expect(await db.select().from(schema.organization)).toHaveLength(1);
  });

  it('takes the only organization without being told its name', async () => {
    const id = newId();
    await db.insert(schema.organization).values({ id, name: 'Courrier Paris' });

    await expect(resolveOrganization(db)).resolves.toEqual({
      id,
      name: 'Courrier Paris',
      created: false,
    });
  });

  it('refuses to pick among several', async () => {
    await db.insert(schema.organization).values([
      { id: newId(), name: 'A' },
      { id: newId(), name: 'B' },
    ]);

    await expect(resolveOrganization(db)).rejects.toBeInstanceOf(
      OrganizationChoiceError,
    );
    await expect(resolveOrganization(db, 'B')).resolves.toMatchObject({
      name: 'B',
      created: false,
    });
  });

  it('creates the organization it is given a name for', async () => {
    await expect(
      resolveOrganization(db, 'Nouveau site'),
    ).resolves.toMatchObject({
      name: 'Nouveau site',
      created: true,
    });
  });
});

describe('chooseOrganization', () => {
  it('decides without writing, so a refused account leaves nothing behind', async () => {
    await expect(chooseOrganization(db)).resolves.toEqual({
      kind: 'new',
      name: DEFAULT_ORGANIZATION_NAME,
    });
    expect(await db.select().from(schema.organization)).toHaveLength(0);

    await db.insert(schema.organization).values([
      { id: newId(), name: 'A' },
      { id: newId(), name: 'B' },
    ]);
    await expect(chooseOrganization(db)).rejects.toBeInstanceOf(
      OrganizationChoiceError,
    );
    await expect(chooseOrganization(db, 'C')).resolves.toEqual({
      kind: 'new',
      name: 'C',
    });
    expect(await db.select().from(schema.organization)).toHaveLength(2);
  });
});

describe('chooseOrganizationFor', () => {
  const appAdmin = { email: 'plateforme@example.test', role: 'platform_admin' };

  it('gives an app admin no organization', async () => {
    expect(await chooseOrganizationFor(db, appAdmin)).toBeNull();
  });

  it('refuses an organization named for an app admin', async () => {
    await expect(chooseOrganizationFor(db, appAdmin, 'X')).rejects.toThrow(
      PlatformAccountError,
    );
  });

  it('still chooses one for any other account', async () => {
    expect(
      await chooseOrganizationFor(
        db,
        { email: 'un@example.test', role: 'shuttle' },
        'X',
      ),
    ).toEqual({ kind: 'new', name: 'X' });
  });
});

describe('resolveOrganizationFor', () => {
  it('creates no organization for an app admin', async () => {
    await expect(
      resolveOrganizationFor(
        db,
        { email: 'plateforme@example.test', role: 'platform_admin' },
        'Nouvelle',
      ),
    ).rejects.toThrow(PlatformAccountError);
    expect(await db.select().from(schema.organization)).toEqual([]);
  });

  it('still creates one for any other account', async () => {
    const resolved = await resolveOrganizationFor(
      db,
      { email: 'un@example.test', role: 'shuttle' },
      'Nouvelle',
    );

    expect(resolved).toMatchObject({ name: 'Nouvelle', created: true });
  });
});

describe('attachToOrganization', () => {
  it('refuses an app admin', async () => {
    const { id } = await resolveOrganization(db, 'Service courrier');

    await expect(attachToOrganization(db, 'app-admin', id)).rejects.toThrow(
      PlatformAccountError,
    );
    expect(await db.select().from(schema.organizationMember)).toEqual([]);
  });

  it('attaches once, and tolerates a repeat', async () => {
    const { id } = await resolveOrganization(db);

    await attachToOrganization(db, 'u1', id);
    await attachToOrganization(db, 'u1', id);

    expect(await db.select().from(schema.organizationMember)).toEqual([
      { userId: 'u1', organizationId: id },
    ]);
  });

  it('refuses to move an account to another organization', async () => {
    const first = await resolveOrganization(db, 'A');
    const second = await resolveOrganization(db, 'B');
    await attachToOrganization(db, 'u2', first.id);

    await expect(
      attachToOrganization(db, 'u2', second.id),
    ).rejects.toBeInstanceOf(AlreadyAttachedError);
  });
});

describe('createCompany', () => {
  const posted = async (organizationId: string) => ({
    departments: await db
      .select({ name: schema.department.name })
      .from(schema.department)
      .where(eq(schema.department.organizationId, organizationId)),
    settings: await db
      .select({ key: schema.setting.key, value: schema.setting.value })
      .from(schema.setting)
      .where(eq(schema.setting.organizationId, organizationId)),
  });

  it('gives the company its mail department and the profile of its model', async () => {
    const small = await createCompany(db, {
      name: 'Petit',
      profileModel: 'small_site',
    });
    const multi = await createCompany(db, {
      name: 'Grand',
      profileModel: 'multi_departments',
    });

    expect(await posted(small)).toEqual({
      departments: [{ name: 'Service courrier' }],
      settings: [
        { key: OPERATING_PROFILE_KEY, value: SMALL_SITE_OPERATING_PROFILE },
      ],
    });
    expect((await posted(multi)).settings[0]?.value).toMatchObject({
      shuttleActsAsDepartment: false,
    });
  });

  it('applies to the company a script creates', async () => {
    const created = await resolveOrganization(db, 'Par script');
    expect((await posted(created.id)).departments).toHaveLength(1);
    expect((await posted(created.id)).settings).toHaveLength(1);
  });
});
