import type { AnyDb } from '@repo/db';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

const migrationsFolder = fileURLToPath(
  new URL('../../../db/drizzle', import.meta.url),
);

export type TestDb = PgliteDatabase<typeof schema>;

export const AGENT_ID = 'agent-1';
export const STRANGER_ID = 'agent-2';
export const OTHER_SHUTTLE_ID = 'shuttle-2';
export const ORGANIZATION_ID = newId();
export const OTHER_ORGANIZATION_ID = newId();

/** A migrated PGlite with two mailrooms and one agent in each. */
export async function openTestDb(): Promise<{ client: PGlite; db: TestDb }> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder });
  await db.insert(schema.organization).values([
    { id: ORGANIZATION_ID, name: 'Service courrier' },
    { id: OTHER_ORGANIZATION_ID, name: 'Autre client' },
  ]);
  await db.insert(schema.user).values([
    { id: AGENT_ID, name: 'Agent', email: 'agent@example.test' },
    { id: STRANGER_ID, name: 'Autre agent', email: 'autre@example.test' },
  ]);
  await db.insert(schema.organizationMember).values([
    { userId: AGENT_ID, organizationId: ORGANIZATION_ID },
    { userId: STRANGER_ID, organizationId: OTHER_ORGANIZATION_ID },
  ]);
  return { client, db };
}

/** A second shuttle of the company, for the files that compare two tours. */
export async function addOtherShuttle(db: TestDb): Promise<void> {
  await db.insert(schema.user).values({
    id: OTHER_SHUTTLE_ID,
    name: 'Autre navette',
    email: 'navette@example.test',
    role: 'shuttle',
  });
  await db
    .insert(schema.organizationMember)
    .values({ userId: OTHER_SHUTTLE_ID, organizationId: ORGANIZATION_ID });
}

export function asAnyDb(db: TestDb): AnyDb {
  return db;
}

export function parcelRow(organizationId = ORGANIZATION_ID) {
  return {
    id: newId(),
    organizationId,
    status: 'recu' as const,
    receivedAt: new Date('2026-10-24T08:00:00Z'),
    receivedBy: organizationId === ORGANIZATION_ID ? AGENT_ID : STRANGER_ID,
  };
}
