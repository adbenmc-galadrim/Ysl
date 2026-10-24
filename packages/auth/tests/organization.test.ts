import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AlreadyAttachedError,
  attachToOrganization,
  DEFAULT_ORGANIZATION_NAME,
  OrganizationChoiceError,
  resolveOrganization,
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
  ]);
});

beforeEach(async () => {
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

describe('attachToOrganization', () => {
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
