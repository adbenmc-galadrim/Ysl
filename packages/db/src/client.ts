import { env } from '@repo/shared/env/server';
import { logger } from '@repo/shared/logger';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from '#schema/index';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
});

pool.on('error', (error) => {
  const { code } = error as Error & { code?: string };
  logger.error({ reason: error.message, code }, 'idle database client errored');
});

export const db = drizzle({ client: pool, schema });

export type Db = typeof db;

/** Any Postgres drizzle over the schema: the pool above, or PGlite in tests. */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Runs `work` on one connection of the pool, for what must stay on the same
 * session: an advisory lock taken and released around several transactions.
 */
export async function withConnection<T>(
  work: (db: AnyDb) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await work(drizzle({ client, schema }));
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
