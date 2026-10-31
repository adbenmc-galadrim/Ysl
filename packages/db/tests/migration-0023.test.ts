import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { newId } from '@repo/shared/id';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

describe('0023_departement_archive', () => {
  const client = new PGlite();
  const org = newId();
  const open = newId();
  const archived = newId();
  const person = newId();

  const addPerson = (id: string, department: string) =>
    client.query(
      `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email, department_id)
       values ($1, $2, 'Nom', 'Prénom', 'nom', $3, $4)`,
      [id, org, `${id}@example.test`, department],
    );

  const addParcel = (id: string, status: string, department: string) => {
    const delivered = status === 'remis';
    return client.query(
      `insert into parcel (id, organization_id, status, received_at, received_by, contact_id, department_id, delivered_at, delivered_by)
       values ($1, $2, $3, now(), 'u', $4, $5, $6, $7)`,
      [
        id,
        org,
        status,
        contact,
        department,
        delivered ? new Date() : null,
        delivered ? 'u' : null,
      ],
    );
  };

  const contact = newId();

  const refused = async (write: Promise<unknown>) => {
    const error = await write.then(
      () => null,
      (caught: { constraint?: string }) => caught,
    );
    expect(error?.constraint).toBe('department_archived');
  };

  beforeAll(async () => {
    await migrate(drizzle({ client, schema }), { migrationsFolder });
    await client.query(
      `insert into organization (id, name) values ($1, 'Client')`,
      [org],
    );
    await client.query(
      `insert into "user" (id, name, email) values ('u', 'U', 'u@example.test')`,
    );
    await client.query(
      `insert into organization_member (user_id, organization_id) values ('u', $1)`,
      [org],
    );
    await client.query(
      `insert into department (id, organization_id, name, deleted_at) values ($1, $3, 'Ouvert', null), ($2, $3, 'Archivé', null)`,
      [open, archived, org],
    );
    await client.query(
      `insert into contact (id, organization_id, name, name_norm, email) values ($1, $2, 'Contact', 'contact', 'contact@example.test')`,
      [contact, org],
    );
    await addPerson(person, open);
  }, 60_000);

  afterAll(() => client.close());

  it('refuses a person or a parcel joining an archived department', async () => {
    const waiting = newId();
    await addParcel(waiting, 'notifie', open);
    await client.query(
      `update department set deleted_at = now() where id = $1`,
      [archived],
    );

    await refused(addPerson(newId(), archived));
    await refused(addParcel(newId(), 'recu', archived));
    await refused(
      client.query(
        `update directory_person set department_id = $1 where id = $2`,
        [archived, person],
      ),
    );
    await refused(
      client.query(`update parcel set department_id = $1 where id = $2`, [
        archived,
        waiting,
      ]),
    );
  });

  it('lets a parcel reopen, but not there: 0032 takes it off the archived department', async () => {
    const delivered = newId();
    await client.query(
      `update department set deleted_at = null where id = $1`,
      [archived],
    );
    await addParcel(delivered, 'retourne', archived);
    await client.query(
      `update department set deleted_at = now() where id = $1`,
      [archived],
    );

    await client.query(`update parcel set updated_at = now() where id = $1`, [
      delivered,
    ]);
    await client.query(
      `update parcel set status = 'notifie', status_seq = status_seq + 1 where id = $1`,
      [delivered],
    );
    const { rows } = await client.query<{ department_id: string | null }>(
      `select department_id from parcel where id = $1`,
      [delivered],
    );
    expect(rows[0]?.department_id).toBeNull();
  });
});
