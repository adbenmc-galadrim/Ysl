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
const before = foldersBefore('0020_synchro_par_departement');

const organizationId = newId();
const otherOrganizationId = newId();
const finance = newId();
const legal = newId();
const foreign = newId();
const personId = newId();
const movedPersonId = newId();

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

const addPerson = (id: string, email: string) =>
  client.query(
    `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email) values ($1, $2, 'Nom', 'Prénom', 'nom', $3)`,
    [id, organizationId, email],
  );

const addParcel = (id: string, person: string | null) =>
  client.query(
    `insert into parcel (id, organization_id, status, received_at, received_by, person_id) values ($1, $2, 'recu', now(), 'agent-1', $3)`,
    [id, organizationId, person],
  );

const addCode = (
  id: string,
  person: string,
  department: string | null,
  org = organizationId,
) =>
  client.query(
    `insert into pickup_code (id, organization_id, person_id, department_id, token_hash, pin_hash, expires_at) values ($1, $2, $3, $4, $5, 'pin', now() + interval '1 day')`,
    [id, org, person, department, id],
  );

async function departmentOf(id: string) {
  const { rows } = await client.query<{ department_id: string | null }>(
    `select department_id from parcel where id = $1`,
    [id],
  );
  return rows[0]?.department_id;
}

async function scopeOf(id: string) {
  const { rows } = await client.query<{ scope_xid: string | null }>(
    `select scope_xid from department where id = $1`,
    [id],
  );
  return rows[0]?.scope_xid;
}

describe('0020_synchro_par_departement', () => {
  it('keeps the rows of before, without a department', async () => {
    await migrate(db, { migrationsFolder: before });
    await client.query(
      `insert into organization (id, name) values ($1, 'Client'), ($2, 'Autre')`,
      [organizationId, otherOrganizationId],
    );
    await client.query(
      `insert into "user" (id, name, email) values ('agent-1', 'Agent', 'agent@example.test')`,
    );
    await client.query(
      `insert into organization_member (user_id, organization_id) values ('agent-1', $1)`,
      [organizationId],
    );
    await addPerson(personId, 'a@example.test');
    const parcelId = newId();
    await client.query(
      `insert into parcel (id, organization_id, status, received_at, received_by, person_id) values ($1, $2, 'recu', now(), 'agent-1', $3)`,
      [parcelId, organizationId, personId],
    );
    const {
      rows: [{ server_xid: xid } = { server_xid: '' }],
    } = await client.query<{ server_xid: string }>(
      `select server_xid from parcel where id = $1`,
      [parcelId],
    );

    await migrate(db, { migrationsFolder });

    expect(await departmentOf(parcelId)).toBeNull();
    const { rows } = await client.query<{ server_xid: string }>(
      `select server_xid from parcel where id = $1`,
      [parcelId],
    );
    expect(rows[0]?.server_xid).toBe(xid);
    await client.query(
      `insert into department (id, organization_id, name) values ($1, $4, 'Finance'), ($2, $4, 'Juridique'), ($3, $5, 'Finance')`,
      [finance, legal, foreign, organizationId, otherOrganizationId],
    );
  }, 30_000);

  it('gives a parcel the department of its person, at creation and when the person changes', async () => {
    await client.query(
      `update directory_person set department_id = $1 where id = $2`,
      [finance, personId],
    );
    await addPerson(movedPersonId, 'b@example.test');
    await client.query(
      `update directory_person set department_id = $1 where id = $2`,
      [legal, movedPersonId],
    );
    const parcelId = newId();
    await addParcel(parcelId, personId);
    expect(await departmentOf(parcelId)).toBe(finance);

    await client.query(`update parcel set person_id = $1 where id = $2`, [
      movedPersonId,
      parcelId,
    ]);
    expect(await departmentOf(parcelId)).toBe(legal);
  });

  it('moves a parcel with its person (0021), and leaves one without a person alone', async () => {
    const parcelId = newId();
    const loose = newId();
    await addParcel(parcelId, personId);
    await addParcel(loose, null);
    await client.query(
      `update directory_person set department_id = $1 where id = $2`,
      [legal, personId],
    );
    await client.query(`update parcel set notes = 'x' where id = $1`, [
      parcelId,
    ]);
    await client.query(`update parcel set department_id = $1 where id = $2`, [
      finance,
      loose,
    ]);

    expect(await departmentOf(parcelId)).toBe(legal);
    expect(await departmentOf(loose)).toBe(finance);
    await client.query(
      `update directory_person set department_id = $1 where id = $2`,
      [finance, personId],
    );
  });

  it('remembers the department a row left, not the one it reached', async () => {
    const parcelId = newId();
    await addParcel(parcelId, personId);
    await client.query(`update department set scope_xid = null`);

    await client.query(`update parcel set department_id = $1 where id = $2`, [
      legal,
      parcelId,
    ]);
    expect(await scopeOf(finance)).not.toBeNull();
    expect(await scopeOf(legal)).toBeNull();

    await client.query(`update department set scope_xid = null`);
    await client.query(
      `update parcel set notes = 'y', department_id = $1 where id = $2`,
      [legal, parcelId],
    );
    expect(await scopeOf(legal)).toBeNull();
    await client.query(
      `update directory_person set department_id = null where id = $1`,
      [movedPersonId],
    );
    expect(await scopeOf(legal)).not.toBeNull();
  });

  it('remembers the department a parcel leaves by changing person', async () => {
    const parcelId = newId();
    await addParcel(parcelId, personId);
    await client.query(`update department set scope_xid = null`);

    await client.query(`update parcel set person_id = null where id = $1`, [
      parcelId,
    ]);
    expect(await scopeOf(finance)).toBeNull();

    await client.query(`update parcel set person_id = $1 where id = $2`, [
      personId,
      parcelId,
    ]);
    const other = newId();
    await addPerson(other, 'c@example.test');
    await client.query(
      `update directory_person set department_id = $1 where id = $2`,
      [legal, other],
    );
    await client.query(`update parcel set person_id = $1 where id = $2`, [
      other,
      parcelId,
    ]);

    expect(await departmentOf(parcelId)).toBe(legal);
    expect(await scopeOf(finance)).not.toBeNull();
    expect(await scopeOf(legal)).toBeNull();
  });

  it('allows one open code per person and per department', async () => {
    await addCode(newId(), personId, finance);
    await addCode(newId(), personId, legal);
    await addCode(newId(), personId, null);
    await expect(addCode(newId(), personId, finance)).rejects.toThrow();
    await expect(addCode(newId(), personId, null)).rejects.toThrow();
  });

  it('refuses a department of another company', async () => {
    await expect(
      client.query(`update parcel set department_id = $1`, [foreign]),
    ).rejects.toThrow();
    await expect(addCode(newId(), movedPersonId, foreign)).rejects.toThrow();
  });
});
