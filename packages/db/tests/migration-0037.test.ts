import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

beforeAll(async () => {
  await migrate(db, { migrationsFolder });
  await client.exec(`
    insert into organization (id, name) values ('${company}', 'Courrier');
    insert into "user" (id, name, email) values ('agent', 'Agent', 'agent@example.test');
    insert into organization_member (organization_id, user_id) values ('${company}', 'agent');
    insert into department (id, organization_id, name) values ('${finance}', '${company}', 'Finance');
  `);
}, 30_000);

afterAll(async () => {
  await client.close();
});

async function person() {
  const id = newId();
  await client.query(
    `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email, department_id)
     values ($1, $2, 'Morel', 'Camille', 'camille morel', $3, $4)`,
    [id, company, `${id}@example.test`, finance],
  );
  return id;
}

async function notified(personId: string) {
  const id = newId();
  await client.query(
    `insert into parcel (id, organization_id, status, received_at, received_by, department_id, person_id, notified_at, deposited_at)
     values ($1, $2, 'notifie', now(), 'agent', $3, $4, now(), now())`,
    [id, company, finance, personId],
  );
  return id;
}

async function codeOf(personId: string) {
  const id = newId();
  await client.query(
    `insert into pickup_code (id, organization_id, person_id, department_id, pin_hash, token_hash, expires_at)
     values ($1, $2, $3, $4, $5, $6, now() + interval '30 days')`,
    [id, company, personId, finance, `p${id}`, `t${id}`],
  );
  return id;
}

const closed = async (id: string) =>
  (
    await client.query<{ deleted_at: Date | null }>(
      'select deleted_at from pickup_code where id = $1',
      [id],
    )
  ).rows[0]?.deleted_at !== null;

const setStatus = (id: string, status: string) =>
  client.query(
    'update parcel set status = $1, status_seq = status_seq + 1 where id = $2',
    [status, id],
  );

describe('a parcel that starts back to its sender', () => {
  it('closes the code once nothing else waits for that person', async () => {
    const who = await person();
    const [first, second] = [await notified(who), await notified(who)];
    const code = await codeOf(who);
    await setStatus(first, 'retour_prepare');
    expect(await closed(code)).toBe(false);
    await setStatus(second, 'retourne');
    expect(await closed(code)).toBe(true);
  });

  it('leaves the code of someone else alone', async () => {
    const [who, other] = [await person(), await person()];
    const parcel = await notified(who);
    await notified(other);
    const code = await codeOf(other);
    await setStatus(parcel, 'retour_prepare');
    expect(await closed(code)).toBe(false);
  });

  it('goes through the shuttle, and comes back step by step', async () => {
    const parcel = await notified(await person());
    await setStatus(parcel, 'retour_prepare');
    await setStatus(parcel, 'retour_en_route');
    await setStatus(parcel, 'retourne');
    await setStatus(parcel, 'retour_en_route');
    await setStatus(parcel, 'retour_prepare');
    await setStatus(parcel, 'notifie');
  });

  it('refuses a stale copy without its counter', async () => {
    const parcel = await notified(await person());
    await setStatus(parcel, 'retour_prepare');
    await expect(
      client.query('update parcel set status = $1 where id = $2', [
        'retour_en_route',
        parcel,
      ]),
    ).rejects.toThrow(/status_seq/);
  });

  it('refuses a reason it does not know', async () => {
    const parcel = await notified(await person());
    await expect(
      client.query('update parcel set return_reason = $1 where id = $2', [
        'tired',
        parcel,
      ]),
    ).rejects.toThrow(/parcel_return_reason_check/);
  });
});

describe('the lost parcels already there', () => {
  it('are told from the returned ones by their note', async () => {
    const fresh = new PGlite();
    const old = drizzle({ client: fresh, schema });
    const folder = mkdtempSync(join(tmpdir(), 'mig-0037-'));
    cpSync(migrationsFolder, folder, { recursive: true });
    const journalPath = join(folder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { tag: string }[];
    };
    const at = journal.entries.findIndex((row) => row.tag.startsWith('0037_'));
    writeFileSync(
      journalPath,
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, at) }),
    );
    await migrate(old, { migrationsFolder: folder });
    await fresh.exec(`
      insert into organization (id, name) values ('${company}', 'Courrier');
      insert into "user" (id, name, email) values ('agent', 'Agent', 'agent@example.test');
      insert into organization_member (organization_id, user_id) values ('${company}', 'agent');
    `);
    const [lost, sent] = [newId(), newId()];
    await fresh.query(
      `insert into parcel (id, organization_id, status, received_at, received_by, notes) values
       ($1, $3, 'retourne', now(), 'agent', 'Déclaré perdu par l’admin de l’entreprise.'),
       ($2, $3, 'retourne', now(), 'agent', null)`,
      [lost, sent, company],
    );
    await migrate(old, { migrationsFolder });
    const { rows } = await fresh.query<{ id: string; return_reason: string }>(
      'select id, return_reason from parcel',
    );
    expect(rows.find(({ id }) => id === lost)?.return_reason).toBe('lost');
    expect(rows.find(({ id }) => id === sent)?.return_reason).toBeNull();
    await fresh.close();
  }, 30_000);
});
