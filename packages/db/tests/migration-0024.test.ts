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
import { SMALL_SITE_OPERATING_PROFILE } from '@repo/contract/operating-profile';
import { newId } from '@repo/shared/id';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const TAG = '0024_conversion_prod';

function folderBefore(tag: string): string {
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

const conversion = readFileSync(join(migrationsFolder, `${TAG}.sql`), 'utf8');

/** One connection, as the migrator: the helper in `pg_temp` is there on a second run too. */
async function convertAgain(client: PGlite) {
  for (const statement of conversion.split('--> statement-breakpoint')) {
    await client.exec(statement);
  }
}

describe(TAG, () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const before = folderBefore(TAG);
  const org = newId();
  const other = newId();
  const pickup = {
    place: 'Accueil',
    hours: { mon: '9-12', tue: '', wed: '', thu: '', fri: '' },
    instructions: '',
  };
  const ids = {
    named: newId(),
    sameWord: newId(),
    bare: newId(),
    gone: newId(),
    contact: newId(),
    sameDept: newId(),
    holder: newId(),
    duplicate: newId(),
    parcelOfDuplicate: newId(),
    closed: newId(),
    closedPerson: newId(),
    ofClosed: newId(),
    wordedContact: newId(),
    forWordedContact: newId(),
    waiting: newId(),
    delivered: newId(),
    deliveredNamed: newId(),
    returned: newId(),
    deleted: newId(),
    forContact: newId(),
    noRecipient: newId(),
    personCode: newId(),
    usedCode: newId(),
    contactCode: newId(),
    otherPerson: newId(),
    otherProfile: newId(),
  };

  const parcel = (
    id: string,
    status: string,
    fields: { person?: string; contact?: string; department?: string } = {},
  ) => {
    const delivered = status === 'remis';
    return client.query(
      `insert into parcel (id, organization_id, status, received_at, received_by, person_id, contact_id, department, delivered_at, delivered_by, deleted_at)
       values ($1, $2, $3, now(), 'u-agent', $4, $5, $6, $7, $8, $9)`,
      [
        id,
        org,
        status,
        fields.person ?? null,
        fields.contact ?? null,
        fields.department ?? null,
        delivered ? new Date() : null,
        delivered ? 'u-agent' : null,
        id === ids.deleted ? new Date() : null,
      ],
    );
  };

  const person = (id: string, department: string | null, orgId = org) =>
    client.query(
      `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email, department)
       values ($1, $2, 'Nom', 'Prénom', 'nom', $3, $4)`,
      [id, orgId, `${id}@example.test`, department],
    );

  const code = (id: string, target: { person?: string; contact?: string }) =>
    client.query(
      `insert into pickup_code (id, organization_id, person_id, contact_id, token_hash, pin_hash, expires_at)
       values ($1, $2, $3, $4, $5, 'pin', now() + interval '1 day')`,
      [id, org, target.person ?? null, target.contact ?? null, id],
    );

  const rows = async <T>(sql: string, params: unknown[] = []) =>
    (await client.query<T>(sql, params)).rows;

  const departmentNamed = async (name: string, orgId = org) =>
    (
      await rows<{ id: string }>(
        `select id from department where organization_id = $1 and lower(name) = lower($2)`,
        [orgId, name],
      )
    )[0]?.id;

  const parcelDepartment = async (id: string) =>
    (
      await rows<{ department_id: string | null }>(
        `select department_id from parcel where id = $1`,
        [id],
      )
    )[0]?.department_id;

  const snapshot = async () =>
    JSON.stringify(
      await Promise.all(
        [
          'department',
          'parcel',
          'directory_person',
          'pickup_code',
          'setting',
          '"user"',
        ].map((table) => rows(`select * from ${table} order by id`)),
      ),
    );

  let parcelsBefore: unknown;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: before });
    await client.query(
      `insert into organization (id, name) values ($1, 'Client'), ($2, 'Autre')`,
      [org, other],
    );
    await client.exec(`
      insert into "user" (id, name, email, role) values
        ('u-admin', 'A', 'admin@example.test', 'admin'),
        ('u-agent', 'B', 'agent@example.test', 'agent'),
        ('u-null', 'C', 'null@example.test', null),
        ('u-unknown', 'F', 'unknown@example.test', 'user'),
        ('u-platform', 'D', 'platform@example.test', 'platform_admin'),
        ('u-department', 'E', 'department@example.test', 'department');
    `);
    await client.query(
      `insert into organization_member (user_id, organization_id) values ('u-agent', $1)`,
      [org],
    );
    await client.query(
      `insert into setting (id, organization_id, key, value) values ($1, $2, 'pickup', $3)`,
      [newId(), org, JSON.stringify(pickup)],
    );
    await client.query(
      `insert into setting (id, organization_id, key, value) values ($1, $2, 'operatingProfile', '{"shuttleActsAsDepartment":false}')`,
      [ids.otherProfile, other],
    );
    await person(ids.named, ' Finance ');
    await person(ids.sameWord, 'FINANCE');
    await person(ids.bare, null);
    await person(ids.gone, 'Parti');
    await client.query(
      `update directory_person set deleted_at = now() where id = $1`,
      [ids.gone],
    );
    await person(ids.otherPerson, 'Finance', other);
    await client.query(
      `insert into contact (id, organization_id, name, name_norm, email) values ($1, $2, 'Contact', 'contact', 'contact@example.test')`,
      [ids.contact, org],
    );
    await parcel(ids.waiting, 'recu', { person: ids.named });
    await parcel(ids.delivered, 'remis', { person: ids.named });
    await parcel(ids.deliveredNamed, 'remis', {
      person: ids.named,
      department: 'Archives',
    });
    await parcel(ids.returned, 'retourne', { person: ids.bare });
    await parcel(ids.deleted, 'recu', { person: ids.bare });
    await parcel(ids.forContact, 'recu', {
      contact: ids.contact,
      department: 'Juridique',
    });
    await parcel(ids.noRecipient, 'a_completer');
    await client.query(
      `insert into contact (id, organization_id, name, name_norm, email, department) values ($1, $2, 'Autre contact', 'autre', 'autre@example.test', 'Achats')`,
      [ids.wordedContact, org],
    );
    await parcel(ids.forWordedContact, 'recu', { contact: ids.wordedContact });
    await code(ids.personCode, { person: ids.named });
    await code(ids.usedCode, { person: ids.bare });
    await client.query(`update pickup_code set used_at = now() where id = $1`, [
      ids.usedCode,
    ]);
    await code(ids.contactCode, { contact: ids.contact });
    await client.query(
      `insert into department (id, organization_id, name) values ($1, $2, 'Fermé')`,
      [ids.closed, org],
    );
    await client.query(
      `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email, department_id, deleted_at)
       values ($1, $2, 'Nom', 'Prénom', 'nom', 'ferme@example.test', $3, now())`,
      [ids.closedPerson, org, ids.closed],
    );
    await parcel(ids.ofClosed, 'remis', { person: ids.closedPerson });
    await client.query(`update parcel set department_id = null where id = $1`, [
      ids.ofClosed,
    ]);
    await client.query(
      `update department set deleted_at = now() where id = $1`,
      [ids.closed],
    );
    await client.query(
      `insert into department (id, organization_id, name) values ($1, $2, 'Doublon')`,
      [ids.sameDept, org],
    );
    await client.query(
      `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email, department_id)
       values ($1, $2, 'Nom', 'Prénom', 'nom', 'meme@example.test', $3)`,
      [ids.holder, org, ids.sameDept],
    );
    await client.query(
      `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email, department)
       values ($1, $2, 'Nom', 'Prénom', 'nom', 'MEME@example.test', 'Doublon')`,
      [ids.duplicate, org],
    );
    await parcel(ids.parcelOfDuplicate, 'recu', { person: ids.duplicate });
    parcelsBefore = await rows(`select id, status from parcel order by id`);
    await migrate(db, { migrationsFolder });
  }, 60_000);

  afterAll(async () => {
    await client.close();
    rmSync(before, { recursive: true, force: true });
  });

  it('makes a default department and one per word, case and spaces aside', async () => {
    expect(
      (
        await rows<{ name: string }>(
          `select name from department where organization_id = $1 and deleted_at is null order by lower(name)`,
          [org],
        )
      ).map((row) => row.name),
    ).toEqual([
      'Achats',
      'Archives',
      'Doublon',
      'FINANCE',
      'Juridique',
      'Service courrier',
    ]);
  });

  it('gives each person their word, or the default department', async () => {
    const finance = await departmentNamed('finance');
    const fallback = await departmentNamed('Service courrier');
    const found = await rows<{ id: string; department_id: string }>(
      `select id, department_id from directory_person where organization_id = $1 and id not in ('${ids.closedPerson}', '${ids.holder}', '${ids.duplicate}')`,
      [org],
    );
    expect(
      Object.fromEntries(found.map((p) => [p.id, p.department_id])),
    ).toEqual({
      [ids.named]: finance,
      [ids.sameWord]: finance,
      [ids.bare]: fallback,
      [ids.gone]: fallback,
    });
  });

  it('keeps every parcel and its status, and leaves none without a department', async () => {
    expect(await rows(`select id, status from parcel order by id`)).toEqual(
      parcelsBefore,
    );
    expect(
      await rows(`select id from parcel where department_id is null`),
    ).toEqual([]);
    const finance = await departmentNamed('finance');
    expect(await parcelDepartment(ids.waiting)).toBe(finance);
    expect(await parcelDepartment(ids.delivered)).toBe(finance);
    expect(await parcelDepartment(ids.deliveredNamed)).toBe(
      await departmentNamed('Archives'),
    );
    expect(await parcelDepartment(ids.returned)).toBe(
      await departmentNamed('Service courrier'),
    );
    expect(await parcelDepartment(ids.forContact)).toBe(
      await departmentNamed('Juridique'),
    );
    expect(await parcelDepartment(ids.forWordedContact)).toBe(
      await departmentNamed('Achats'),
    );
    expect(await parcelDepartment(ids.noRecipient)).toBe(
      await departmentNamed('Service courrier'),
    );
  });

  it('does not stop on an e-mail the department already holds: the person waits, their parcel goes on', async () => {
    const [person] = await rows<{ department_id: string | null }>(
      `select department_id from directory_person where id = $1`,
      [ids.duplicate],
    );
    expect(person?.department_id).toBeNull();
    expect(await parcelDepartment(ids.parcelOfDuplicate)).toBe(
      await departmentNamed('Service courrier'),
    );
  });

  it('sends nobody to an archived department', async () => {
    expect(await parcelDepartment(ids.ofClosed)).toBe(
      await departmentNamed('Service courrier'),
    );
  });

  it('moves the open codes only: a contact’s with its waiting parcel', async () => {
    const codeOf = Object.fromEntries(
      (
        await rows<{ id: string; department_id: string | null }>(
          `select id, department_id from pickup_code`,
        )
      ).map((row) => [row.id, row.department_id]),
    );
    expect(codeOf[ids.personCode]).toBe(await departmentNamed('finance'));
    expect(codeOf[ids.contactCode]).toBe(await departmentNamed('Juridique'));
    expect(codeOf[ids.usedCode]).toBeNull();
  });

  it('copies the pickup setting to each department and keeps the setting', async () => {
    const found = await rows<{ pickup: unknown }>(
      `select pickup from department where organization_id = $1 and deleted_at is null`,
      [org],
    );
    expect(found).toHaveLength(6);
    for (const row of found) expect(row.pickup).toEqual(pickup);
    expect(
      await rows(
        `select value from setting where organization_id = $1 and key = 'pickup'`,
        [org],
      ),
    ).toEqual([{ value: pickup }]);
  });

  it('sets the small-site profile, and keeps one a company already chose', async () => {
    const value = async (orgId: string) =>
      (
        await rows<{ value: unknown }>(
          `select value from setting where organization_id = $1 and key = 'operatingProfile'`,
          [orgId],
        )
      )[0]?.value;
    expect(await value(org)).toEqual(SMALL_SITE_OPERATING_PROFILE);
    expect(await value(other)).toEqual({ shuttleActsAsDepartment: false });
  });

  it('maps the roles; a null role was read as an agent, an unknown one stays', async () => {
    const found = await rows<{ id: string; role: string }>(
      `select id, role from "user" order by id`,
    );
    expect(Object.fromEntries(found.map((u) => [u.id, u.role]))).toEqual({
      'u-admin': 'company_admin',
      'u-agent': 'shuttle',
      'u-null': 'shuttle',
      'u-unknown': 'user',
      'u-platform': 'platform_admin',
      'u-department': 'department',
    });
  });

  it('writes valid v7 ids', async () => {
    expect(
      await rows(
        `select id from department where coalesce(uuid_extract_version(id), 0) <> 7`,
      ),
    ).toEqual([]);
  });

  it('changes nothing the second time', async () => {
    const first = await snapshot();
    await convertAgain(client);
    expect(await snapshot()).toBe(first);
  });

  it('fills what came after a first run, and keeps a word it already made', async () => {
    const late = newId();
    await person(late, 'Juridique');
    await convertAgain(client);
    expect(
      (
        await rows<{ department_id: string }>(
          `select department_id from directory_person where id = $1`,
          [late],
        )
      )[0]?.department_id,
    ).toBe(await departmentNamed('Juridique'));
    await client.query(
      `update directory_person set deleted_at = now() where id = $1`,
      [late],
    );
  });
});

describe(`${TAG}, on an empty database`, () => {
  it('does nothing, twice over', async () => {
    const client = new PGlite();
    await migrate(drizzle({ client, schema }), { migrationsFolder });
    await convertAgain(client);
    const { rows } = await client.query(`select id from department`);
    expect(rows).toEqual([]);
    await client.close();
  }, 60_000);
});
