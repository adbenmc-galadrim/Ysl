import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { organization } from '#schema/organization';

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
    // Id of the transaction that last wrote the row, set by the stamp_server_xid
    // trigger (drizzle/0002_curseur_sync.sql): a new synced table needs its own.
    serverXid: bigint('server_xid', { mode: 'number' })
      .default(sql`pg_current_xact_id()::text::bigint`)
      .notNull(),
  };
}

type SyncTable = {
  id: AnyPgColumn;
  organizationId: AnyPgColumn;
  serverXid: AnyPgColumn;
};

export function syncConstraints(
  name: string,
  table: SyncTable,
  { referenced = false }: { referenced?: boolean } = {},
) {
  return [
    index(`${name}_cursor_idx`).on(
      table.organizationId,
      table.serverXid,
      table.id,
    ),
    // Target of the composite (organization_id, id) foreign keys of 0002.
    ...(referenced
      ? [
          uniqueIndex(`${name}_organization_id_idx`).on(
            table.organizationId,
            table.id,
          ),
        ]
      : []),
    check(
      `${name}_id_v7`,
      sql`coalesce(uuid_extract_version(${table.id}), 0) = 7`,
    ),
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
