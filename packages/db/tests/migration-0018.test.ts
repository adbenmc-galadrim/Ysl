import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, describe, expect, it } from 'vitest';
import { newId } from '@repo/shared/id';
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

function foldersBefore(tag: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'ysl-migrations-'));
  cpSync(migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: { tag: string }[];
  };
  const at = journal.entries.findIndex((entry) => entry.tag === tag);
  journal.entries = journal.entries.slice(0, at);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

const client = new PGlite();
const db = drizzle({ client, schema });
const before = foldersBefore('0018_departements');
const beforeConversion = foldersBefore('0024_conversion_prod');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
  rmSync(beforeConversion, { recursive: true, force: true });
});

describe('0018_departements', () => {
  it('keeps accounts and parcels, and ties a member to its own company', async () => {
    await migrate(db, { migrationsFolder: before });
    const organizationId = newId();
    const otherOrganizationId = newId();
    const parcelId = newId();
    await client.query(
      `insert into organization (id, name) values ($1, 'Service courrier'), ($2, 'Autre client')`,
      [organizationId, otherOrganizationId],
    );
    await client.query(
      `insert into "user" (id, name, email, role) values ('agent-1', 'Agent', 'agent@example.test', 'agent')`,
    );
    await client.query(
      `insert into organization_member (user_id, organization_id) values ('agent-1', $1)`,
      [organizationId],
    );
    await client.query(
      `insert into parcel (id, organization_id, status, received_at, received_by) values ($1, $2, 'recu', now(), 'agent-1')`,
      [parcelId, organizationId],
    );
    await client.query(
      `insert into setting (id, organization_id, key, value) values ($1, $2, 'pickup', '{"place":"Accueil"}')`,
      [newId(), organizationId],
    );
    const snapshot = async () => ({
      user: (await client.query(`select * from "user"`)).rows,
      member: (await client.query(`select * from organization_member`)).rows,
      parcel: (
        await client.query(
          `select id, organization_id, status, received_at, server_xid from parcel`,
        )
      ).rows,
      setting: (await client.query(`select * from setting`)).rows,
    });
    const old = await snapshot();

    await migrate(db, { migrationsFolder: beforeConversion });

    expect(await snapshot()).toEqual(old);
    expect((await client.query(`select * from department`)).rows).toHaveLength(
      0,
    );

    const departmentId = newId();
    const foreignDepartmentId = newId();
    const addDepartment = (id: string, company: string, name: string) =>
      client.query(
        `insert into department (id, organization_id, name) values ($1, $2, $3)`,
        [id, company, name],
      );
    await addDepartment(departmentId, organizationId, 'Finance');
    await addDepartment(foreignDepartmentId, otherOrganizationId, 'Finance');
    await expect(
      addDepartment(newId(), organizationId, 'finance'),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.departmentMember).values({
        userId: 'agent-1',
        organizationId,
        departmentId: foreignDepartmentId,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.departmentMember).values({
        userId: 'agent-1',
        organizationId: otherOrganizationId,
        departmentId: foreignDepartmentId,
      }),
    ).rejects.toThrow();
    await db
      .insert(schema.departmentMember)
      .values({ userId: 'agent-1', organizationId, departmentId });
  }, 30_000);
});
