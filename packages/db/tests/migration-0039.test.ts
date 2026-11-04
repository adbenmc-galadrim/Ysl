import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { newId } from '@repo/shared/id';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, describe, expect, it } from 'vitest';
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const TAG = '0039_retrait_ancien_modele';

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

const org = newId();
const ids = {
  finance: newId(),
  mail: newId(),
  closed: newId(),
};
let client: PGlite;

async function before() {
  client = new PGlite();
  await migrate(drizzle({ client, schema }), {
    migrationsFolder: folderBefore(TAG),
  });
  await client.exec(`
    insert into organization (id, name) values ('${org}', 'Courrier');
    insert into "user" (id, name, email) values ('agent', 'Agent', 'agent@example.test');
    insert into organization_member (organization_id, user_id) values ('${org}', 'agent');
    insert into department (id, organization_id, name) values
      ('${ids.finance}', '${org}', 'Finance'),
      ('${ids.mail}', '${org}', 'Service courrier');
    insert into department (id, organization_id, name, deleted_at) values
      ('${ids.closed}', '${org}', 'Fermé', now());
  `);
}

const after = () => migrate(drizzle({ client, schema }), { migrationsFolder });

afterEach(async () => {
  await client.close();
});

async function person(department: string | null, departmentId?: string) {
  const id = newId();
  await client.query(
    department === null
      ? `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email, department_id)
         values ($1, $2, 'Morel', 'Camille', 'camille morel', $3, $4)`
      : `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email, department_id, department)
         values ($1, $2, 'Morel', 'Camille', 'camille morel', $3, $4, $5)`,
    department === null
      ? [id, org, `${id}@example.test`, departmentId ?? null]
      : [id, org, `${id}@example.test`, departmentId ?? null, department],
  );
  return id;
}

async function parcel(fields: {
  department?: string;
  departmentId?: string;
  notes?: string;
  deleted?: boolean;
  personId?: string;
}) {
  const id = newId();
  await client.query(
    `insert into parcel (id, organization_id, status, received_at, received_by, department, department_id, notes, deleted_at, person_id)
     values ($1, $2, 'a_completer', now(), 'agent', $3, $4, $5, $6, $7)`,
    [
      id,
      org,
      fields.department ?? null,
      fields.departmentId ?? null,
      fields.notes ?? null,
      fields.deleted ? new Date() : null,
      fields.personId ?? null,
    ],
  );
  return id;
}

async function row<T>(sql: string, id: string): Promise<T | undefined> {
  const { rows } = await client.query<T>(sql, [id]);
  return rows[0];
}

describe('the drop of the department words', () => {
  it('gives a row without department the open one its word names', async () => {
    await before();
    const card = await person(' finance ');
    const ofCard = await parcel({ personId: card });
    const box = await parcel({ department: 'FINANCE' });
    const shut = await parcel({ department: 'Fermé' });
    await after();

    expect(
      await row(
        'select department_id from directory_person where id = $1',
        card,
      ),
    ).toEqual({ department_id: ids.finance });
    expect(
      await row('select department_id from parcel where id = $1', ofCard),
    ).toEqual({ department_id: ids.finance });
    expect(
      await row('select department_id, notes from parcel where id = $1', box),
    ).toEqual({ department_id: ids.finance, notes: null });
    expect(
      await row('select department_id, notes from parcel where id = $1', shut),
    ).toEqual({ department_id: null, notes: 'Ancien département : Fermé' });
  }, 30_000);

  it('keeps the other word of a parcel in its notes, not that of a deleted one', async () => {
    await before();
    const kept = await parcel({ department: 'Atelier', notes: 'Fragile' });
    const gone = await parcel({ department: 'Atelier', deleted: true });
    const held = await parcel({
      department: 'Ancien nom',
      departmentId: ids.finance,
    });
    await after();

    expect(await row('select notes from parcel where id = $1', kept)).toEqual({
      notes: 'Ancien département : Atelier\nFragile',
    });
    expect(await row('select notes from parcel where id = $1', gone)).toEqual({
      notes: null,
    });
    expect(
      await row('select department_id, notes from parcel where id = $1', held),
    ).toEqual({ department_id: ids.finance, notes: null });
  }, 30_000);

  it('stops on a card whose word names no department, and says so', async () => {
    await before();
    await person('Atelier');

    const refused = await after().then(
      () => null,
      (error: Error) => error.cause,
    );
    expect(String((refused as Error | null)?.message)).toMatch(
      /^YSL-140: 1 fiche/,
    );
  }, 30_000);

  it('drops the two columns, the contact keeping its service', async () => {
    await before();
    await after();

    const { rows } = await client.query<{ table_name: string }>(
      `select table_name from information_schema.columns
        where column_name = 'department' and table_schema = 'public'
        order by table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(['contact']);
  }, 30_000);
});

describe('a pickup code', () => {
  async function code(personId: string | null, contactId: string | null) {
    const id = newId();
    await client.query(
      `insert into pickup_code (id, organization_id, person_id, contact_id, token_hash, pin_hash, expires_at)
       values ($1, $2, $3, $4, $5, $6, now() + interval '7 days')`,
      [id, org, personId, contactId, `t-${id}`, `p-${id}`],
    );
    return id;
  }
  const departmentOf = async (id: string) =>
    (
      await row<{ department_id: string | null }>(
        'select department_id from pickup_code where id = $1',
        id,
      )
    )?.department_id;

  it('opened without department before takes its person’s', async () => {
    await before();
    const card = await person(null, ids.finance);
    const open = await code(card, null);
    await after();

    expect(await departmentOf(open)).toBe(ids.finance);
  }, 30_000);

  it('written without department takes its person’s, else the mail department', async () => {
    await before();
    await after();
    const card = await person(null, ids.finance);
    const contact = newId();
    await client.query(
      `insert into contact (id, organization_id, name, name_norm) values ($1, $2, 'Atelier', 'atelier')`,
      [contact, org],
    );

    expect(await departmentOf(await code(card, null))).toBe(ids.finance);
    expect(await departmentOf(await code(null, contact))).toBe(ids.mail);
  }, 30_000);

  it('of a contact follows its parcel waiting at a department, deposited too', async () => {
    await before();
    await after();
    const contact = newId();
    await client.query(
      `insert into contact (id, organization_id, name, name_norm) values ($1, $2, 'Atelier', 'atelier')`,
      [contact, org],
    );
    await client.query(
      `insert into parcel (id, organization_id, status, received_at, received_by, contact_id, department_id, deposited_at)
       values ($1, $2, 'depose', now(), 'agent', $3, $4, now())`,
      [newId(), org, contact, ids.finance],
    );

    expect(await departmentOf(await code(null, contact))).toBe(ids.finance);
  }, 30_000);
});
