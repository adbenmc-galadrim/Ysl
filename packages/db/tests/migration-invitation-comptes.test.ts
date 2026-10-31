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
import * as schema from '#schema/index';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

function folderBefore(suffix: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'ysl-migrations-'));
  cpSync(migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: { tag: string }[];
  };
  const at = journal.entries.findIndex((entry) => entry.tag.endsWith(suffix));
  journal.entries = journal.entries.slice(0, at);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

const client = new PGlite();
const db = drizzle({ client, schema });
const before = folderBefore('_invitation_comptes');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

describe('invitation_comptes', () => {
  it('asks nothing of the accounts already there, and keeps their sessions', async () => {
    await migrate(db, { migrationsFolder: before });
    await client.exec(`
      insert into "user" (id, name, email, role) values ('a', 'A', 'a@example.test', 'shuttle');
      insert into account (id, account_id, provider_id, user_id, password, updated_at)
        values ('c', 'a', 'credential', 'a', 'hash', now());
      insert into session (id, expires_at, token, updated_at, user_id)
        values ('s', '2099-01-01', 't', now(), 'a');
    `);
    const row = async (table: string) =>
      (await client.query<Record<string, unknown>>(`select * from "${table}"`))
        .rows;
    const users = await row('user');
    const sessions = await row('session');
    const accounts = await row('account');

    await migrate(db, { migrationsFolder });

    expect(await row('user')).toEqual(
      users.map((user) => ({ ...user, password_change_required_at: null })),
    );
    expect(await row('session')).toEqual(sessions);
    expect(await row('account')).toEqual(accounts);
  }, 60_000);
});
