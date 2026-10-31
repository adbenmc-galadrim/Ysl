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
const TAG = '0029_reglages_entreprise';

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
const folder = folderBefore(TAG);

afterAll(async () => {
  rmSync(folder, { recursive: true, force: true });
  await client.close();
});

describe('migration 0029', () => {
  it('gives the companies already there the address the code held, and nothing else', async () => {
    await migrate(db, { migrationsFolder: folder });
    const company = newId();
    await client.exec(
      `insert into organization (id, name) values ('${company}', 'Courrier')`,
    );

    await migrate(db, { migrationsFolder });

    const settings = await client.query<{ value: Record<string, unknown> }>(
      `select value from setting where organization_id = '${company}' and key = 'company'`,
    );
    expect(settings.rows).toEqual([
      {
        value: {
          reception: {
            postalCode: '75007',
            anchors: [
              'Yves Saint Laurent',
              'Saint Laurent',
              'YSL',
              'Saint',
              'Bellechasse',
            ],
          },
        },
      },
    ]);
  });

  it('changes nothing when played again', async () => {
    const seed = readFileSync(join(migrationsFolder, `${TAG}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .at(-1)!;
    const count = async () =>
      (await client.query(`select id from setting where key = 'company'`)).rows
        .length;
    const before = await count();
    await client.exec(seed);
    expect(await count()).toBe(before);
  });

  it('adds nothing on an empty database', async () => {
    const empty = new PGlite();
    await migrate(drizzle({ client: empty, schema }), { migrationsFolder });
    expect((await empty.query(`select 1 from setting`)).rows).toEqual([]);
    await empty.close();
  });

  it('leaves a company created afterwards without any setting', async () => {
    const later = newId();
    await client.exec(
      `insert into organization (id, name) values ('${later}', 'Atelier')`,
    );
    const settings = await client.query(
      `select 1 from setting where organization_id = '${later}'`,
    );
    expect(settings.rows).toEqual([]);
  });

  it('erases a logo with its company', async () => {
    const gone = newId();
    await client.exec(`
      insert into organization (id, name) values ('${gone}', 'Partie');
      insert into company_logo (organization_id, content_type, bytes, width, height)
        values ('${gone}', 'image/png', '\\x89', 1, 1);
      delete from organization where id = '${gone}';
    `);
    const logos = await client.query(`select 1 from company_logo`);
    expect(logos.rows).toEqual([]);
  });
}, 60_000);
