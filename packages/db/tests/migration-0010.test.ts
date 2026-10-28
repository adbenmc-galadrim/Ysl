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
const before = foldersBefore('0010_service_contact');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

describe('0010_service_contact', () => {
  it('keeps the contacts already there, without a department', async () => {
    await migrate(db, { migrationsFolder: before });
    const organizationId = newId();
    const contactId = newId();
    await db
      .insert(schema.organization)
      .values({ id: organizationId, name: 'Service courrier' });
    await client.query(
      `insert into contact (id, organization_id, name, name_norm, email, usage_count) values ($1, $2, 'Marc Petit', 'marc petit', 'marc@interim.fr', 3)`,
      [contactId, organizationId],
    );

    await migrate(db, { migrationsFolder });

    const { rows } = await client.query<Record<string, unknown>>(
      `select name, email, usage_count, department from contact where id = $1`,
      [contactId],
    );
    expect(rows).toEqual([
      {
        name: 'Marc Petit',
        email: 'marc@interim.fr',
        usage_count: 3,
        department: null,
      },
    ]);
  }, 30_000);
});
