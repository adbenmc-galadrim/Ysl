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

/** The migrations as the server had them before 0006. */
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
const before = foldersBefore('0006_reserve_colis');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

describe('0006_reserve_colis', () => {
  it('gives the parcels already there no reserve, without sending them again', async () => {
    await migrate(db, { migrationsFolder: before });
    const organizationId = newId();
    const parcelId = newId();
    await db
      .insert(schema.organization)
      .values({ id: organizationId, name: 'Service courrier' });
    await db
      .insert(schema.user)
      .values({ id: 'agent-1', name: 'Agent', email: 'agent@example.test' });
    await db
      .insert(schema.organizationMember)
      .values({ userId: 'agent-1', organizationId });
    await client.query(
      `insert into parcel (id, organization_id, status, received_at, received_by, notes) values ($1, $2, 'recu', now(), 'agent-1', 'Étagère A')`,
      [parcelId, organizationId],
    );
    const row = async () =>
      (
        await client.query<Record<string, unknown>>(
          `select * from parcel where id = $1`,
          [parcelId],
        )
      ).rows[0];
    const old = await row();

    await migrate(db, { migrationsFolder });

    expect(await row()).toEqual({
      ...old,
      damage: null,
      damage_note: null,
      damage_notify: false,
      damage_carrier_reserve: false,
      damaged_at: null,
    });
  }, 30_000);
});
