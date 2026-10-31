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

/** The migrations as the server had them before `tag`. */
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
const before = foldersBefore('0014_prevenir_autrement');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

describe('0014_prevenir_autrement', () => {
  it('keeps the contacts already there, with nobody to tell for them', async () => {
    await migrate(db, { migrationsFolder: before });
    const organizationId = newId();
    const contactId = newId();
    await client.query('insert into organization (id, name) values ($1, $2)', [
      organizationId,
      'Service courrier',
    ]);
    await client.query(
      `insert into contact (id, organization_id, name, name_norm, email, usage_count) values ($1, $2, 'Marc Petit', 'marc petit', null, 2)`,
      [contactId, organizationId],
    );
    await migrate(db, { migrationsFolder });

    const contacts = await client.query<Record<string, unknown>>(
      `select name, usage_count, notify_via from contact where id = $1`,
      [contactId],
    );
    expect(contacts.rows).toEqual([
      { name: 'Marc Petit', usage_count: 2, notify_via: null },
    ]);
  }, 30_000);
});
