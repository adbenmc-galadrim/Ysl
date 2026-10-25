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

/** The migrations as the server had them before 0005. */
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
const before = foldersBefore('0005_statuts_reversibles');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

describe('0005_statuts_reversibles', () => {
  it('starts the parcels already there at 0, without sending them again', async () => {
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
      `insert into parcel (id, organization_id, status, received_at, received_by) values ($1, $2, 'recu', now(), 'agent-1')`,
      [parcelId, organizationId],
    );
    const xid = async () =>
      (
        await client.query<{ server_xid: string; status_seq?: number }>(
          `select * from parcel where id = $1`,
          [parcelId],
        )
      ).rows[0];
    const old = await xid();

    await migrate(db, { migrationsFolder });

    const now = await xid();
    expect(now?.status_seq).toBe(0);
    expect(now?.server_xid).toBe(old?.server_xid);
  }, 30_000);
});
