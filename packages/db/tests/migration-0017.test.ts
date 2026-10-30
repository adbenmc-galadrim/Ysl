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
const before = foldersBefore('0017_statut_reel_envoi');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

describe('0017_statut_reel_envoi', () => {
  it('leaves the mails already there untouched', async () => {
    await migrate(db, { migrationsFolder: before });
    const organizationId = newId();
    const mailId = newId();
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
      `insert into parcel (id, organization_id, status, received_at, received_by) values ($1, $2, 'recu', now(), 'agent-1')`,
      [parcelId, organizationId],
    );
    await client.query(
      `insert into notification (id, organization_id, type, recipients, parcel_ids, prepared_at, prepared_by) values ($1, $2, 'avis', array['a@example.test'], array[$3::uuid], now(), 'agent-1')`,
      [mailId, organizationId, parcelId],
    );
    const row = async () =>
      (
        await client.query<Record<string, unknown>>(
          `select * from notification where id = $1`,
          [mailId],
        )
      ).rows[0];
    const old = await row();

    await migrate(db, { migrationsFolder });

    expect(await row()).toEqual({
      ...old,
      delivery_status: null,
      delivery_at: null,
    });
  }, 30_000);
});
