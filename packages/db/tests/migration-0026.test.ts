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
import { newId } from '@repo/shared/id';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, describe, expect, it } from 'vitest';
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

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

const client = new PGlite();
const db = drizzle({ client, schema });
const folder = folderBefore('0026_statuts_tournee');

afterAll(async () => {
  rmSync(folder, { recursive: true, force: true });
  await client.close();
});

describe('migration 0026', () => {
  it('leaves every parcel of the shuttles as it was', async () => {
    await migrate(db, { migrationsFolder: folder });
    const organization = newId();
    const agent = 'agent-1';
    await client.exec(`
      insert into organization (id, name) values ('${organization}', 'Courrier');
      insert into "user" (id, name, email) values ('${agent}', 'Agent', 'a@example.test');
      insert into organization_member (user_id, organization_id)
        values ('${agent}', '${organization}');
    `);
    const person = newId();
    await client.query(
      `insert into directory_person (id, organization_id, last_name, first_name, name_norm, email)
       values ($1, $2, 'Martin', 'Camille', 'martin camille', 'c@example.test')`,
      [person, organization],
    );
    for (const status of [
      'a_completer',
      'recu',
      'notifie',
      'remis',
      'retourne',
    ]) {
      await client.query(
        `insert into parcel (id, organization_id, status, received_at, received_by, person_id, delivered_at, delivered_by)
         values ($1, $2, $3, now(), $4, $5,
                 case when $3 = 'remis' then now() end,
                 case when $3 = 'remis' then $4 end)`,
        [newId(), organization, status, agent, person],
      );
    }
    const read = async () =>
      (
        await client.query(
          `select id, status, status_seq, server_xid, department_id, notified_at
             from parcel order by id`,
        )
      ).rows;
    const before = await read();

    await migrate(db, { migrationsFolder });

    expect(before).toHaveLength(5);
    expect(await read()).toEqual(before);
  }, 30_000);
});
