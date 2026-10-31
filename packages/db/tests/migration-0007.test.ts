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
const before = foldersBefore('0007_suivi_emails');

afterAll(async () => {
  await client.close();
  rmSync(before, { recursive: true, force: true });
});

describe('0007_suivi_emails', () => {
  it('keeps a mail already sent as sent, and refuses a sent mail without its date', async () => {
    await migrate(db, { migrationsFolder: before });
    const organizationId = newId();
    const sent = newId();
    const prepared = newId();
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
    const parcelId = newId();
    await client.query(
      `insert into parcel (id, organization_id, status, received_at, received_by) values ($1, $2, 'recu', now(), 'agent-1')`,
      [parcelId, organizationId],
    );
    const insert = (id: string, sentAt: string | null) =>
      client.query(
        `insert into notification (id, organization_id, type, recipients, parcel_ids, prepared_at, prepared_by, sent_at) values ($1, $2, 'avis', '{a@b.fr}', $3, now(), 'agent-1', $4)`,
        [id, organizationId, [parcelId], sentAt],
      );
    await insert(sent, '2026-10-20T10:00:00Z');
    await insert(prepared, null);

    await migrate(db, { migrationsFolder });

    const statuses = await client.query<{ id: string; status: string }>(
      `select id, status from notification order by id`,
    );
    expect(
      Object.fromEntries(statuses.rows.map((row) => [row.id, row.status])),
    ).toEqual({
      [sent]: 'sent',
      [prepared]: 'prepared',
    });
    await expect(
      client.query(`update notification set status = 'sent' where id = $1`, [
        prepared,
      ]),
    ).rejects.toThrow(/notification_sent_check/);
    await expect(
      client.query(
        `update notification set failed_reason = 'x' where id = $1`,
        [prepared],
      ),
    ).rejects.toThrow(/notification_failed_check/);
  }, 30_000);
});
