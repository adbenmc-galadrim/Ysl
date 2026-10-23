import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgSequence,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { organization } from '#schema/organization';

export const syncSeq = pgSequence('sync_seq');

export function syncColumns() {
  return {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    // Overwritten on every insert and real update by the bump_server_seq
    // trigger (drizzle/0002_curseur_sync.sql): a new synced table needs its own.
    serverSeq: bigint('server_seq', { mode: 'number' })
      .default(sql`nextval('sync_seq')`)
      .notNull(),
  };
}

type SyncTable = {
  id: AnyPgColumn;
  organizationId: AnyPgColumn;
  serverSeq: AnyPgColumn;
};

export function syncConstraints(name: string, table: SyncTable) {
  return [
    index(`${name}_cursor_idx`).on(table.organizationId, table.serverSeq),
    check(`${name}_id_v7`, sql`uuid_extract_version(${table.id}) = 7`),
  ];
}

export function oneOf(
  name: string,
  column: AnyPgColumn,
  values: readonly string[],
) {
  const list = sql.raw(values.map((value) => `'${value}'`).join(', '));
  return check(name, sql`${column} in (${list})`);
}
