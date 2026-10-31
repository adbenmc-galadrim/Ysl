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
const before = foldersBefore('0013_preuves_remise');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

describe('0013_preuves_remise', () => {
  it('says the handovers already there carry no proof, without sending them again', async () => {
    await migrate(db, { migrationsFolder: before });
    const organizationId = newId();
    const parcelId = newId();
    const handoverId = newId();
    await client.query('insert into organization (id, name) values ($1, $2)', [
      organizationId,
      'Service courrier',
    ]);
    await client.query(
      `insert into "user" (id, name, email) values ($1, $2, $3)`,
      ['agent-1', 'Agent', 'agent@example.test'],
    );
    await db
      .insert(schema.organizationMember)
      .values({ userId: 'agent-1', organizationId });
    await client.query(
      `insert into parcel (id, organization_id, status, received_at, received_by) values ($1, $2, 'recu', now(), 'agent-1')`,
      [parcelId, organizationId],
    );
    await client.query(
      `insert into handover (id, organization_id, parcel_ids, recipient_name, method, agent_id, at) values ($1, $2, array[$3::uuid], 'Nora Haddad', 'manuel', 'agent-1', now())`,
      [handoverId, organizationId, parcelId],
    );
    const row = async () =>
      (
        await client.query<Record<string, unknown>>(
          `select * from handover where id = $1`,
          [handoverId],
        )
      ).rows[0];
    const old = await row();

    await migrate(db, { migrationsFolder });

    expect(await row()).toMatchObject({
      ...old,
      has_signature: false,
      has_photo: false,
    });
  }, 30_000);
});
