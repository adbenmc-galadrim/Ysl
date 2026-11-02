import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { newId } from '@repo/shared/id';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const client = new PGlite();
const db = drizzle({ client, schema });
const company = newId();
const finance = newId();
const legal = newId();

beforeAll(async () => {
  await migrate(db, { migrationsFolder });
  await client.exec(`
    insert into organization (id, name) values ('${company}', 'Courrier');
    insert into "user" (id, name, email) values ('agent', 'Agent', 'agent@example.test');
    insert into organization_member (organization_id, user_id) values ('${company}', 'agent');
    insert into department (id, organization_id, name) values
      ('${finance}', '${company}', 'Finance'),
      ('${legal}', '${company}', 'Juridique');
  `);
}, 30_000);

afterAll(async () => {
  await client.close();
});

async function parcelAt(departmentId: string | null, location: string | null) {
  const id = newId();
  await client.query(
    `insert into parcel (id, organization_id, status, received_at, received_by, department_id, location)
     values ($1, $2, 'recu', now(), 'agent', $3, $4)`,
    [id, company, departmentId, location],
  );
  return id;
}

async function locationOf(id: string) {
  const { rows } = await client.query<{ location: string | null }>(
    'select location from parcel where id = $1',
    [id],
  );
  return rows[0]?.location;
}

describe('the location of a parcel', () => {
  it('stays behind when the parcel changes department', async () => {
    const id = await parcelAt(finance, 'Étagère A');
    await client.query('update parcel set department_id = $1 where id = $2', [
      legal,
      id,
    ]);
    expect(await locationOf(id)).toBeNull();
  });

  it('survives any other write, and the first department given', async () => {
    const same = await parcelAt(finance, 'Étagère A');
    await client.query("update parcel set notes = 'x' where id = $1", [same]);
    expect(await locationOf(same)).toBe('Étagère A');

    const placeless = await parcelAt(null, 'Casier 3');
    await client.query('update parcel set department_id = $1 where id = $2', [
      finance,
      placeless,
    ]);
    expect(await locationOf(placeless)).toBe('Casier 3');
  });

  it('keeps the one written with the move', async () => {
    const id = await parcelAt(finance, 'Étagère A');
    await client.query(
      "update parcel set department_id = $1, location = 'Casier 3' where id = $2",
      [legal, id],
    );
    expect(await locationOf(id)).toBe('Casier 3');
  });
});
