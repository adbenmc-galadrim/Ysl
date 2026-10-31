import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@repo/db/schema';
import { verifyPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CREDENTIAL_PROVIDER, credentialRow, setPassword } from '#password';

const client = new PGlite();
const db = drizzle({ client, schema });

const storedPassword = async (userId: string) => {
  const rows = await db
    .select({ password: schema.account.password })
    .from(schema.account)
    .where(eq(schema.account.userId, userId));
  expect(rows).toHaveLength(1);
  return rows[0]?.password ?? '';
};

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL('../../db/drizzle', import.meta.url),
    ),
  });
  await db.insert(schema.user).values([
    { id: 'with', name: 'A', email: 'a@example.test' },
    { id: 'without', name: 'B', email: 'b@example.test' },
  ]);
  await db.insert(schema.account).values(await credentialRow('with', 'ancien-mdp'));
  await db.insert(schema.session).values({
    id: 's1',
    token: 't1',
    userId: 'with',
    expiresAt: new Date('2099-01-01'),
    updatedAt: new Date(),
  });
}, 60_000);

afterAll(async () => {
  await client.close();
});

describe('setPassword', () => {
  it('replaces the hash with one Better Auth accepts, and only the new password', async () => {
    await setPassword(db, 'with', 'nouveau-mdp');
    const hash = await storedPassword('with');
    expect(await verifyPassword({ hash, password: 'nouveau-mdp' })).toBe(true);
    expect(await verifyPassword({ hash, password: 'ancien-mdp' })).toBe(false);
  });

  it('keeps the open sessions: closing one would empty a phone', async () => {
    const sessions = await db.select().from(schema.session);
    expect(sessions.map((row) => row.id)).toEqual(['s1']);
  });

  it('gives a password to an account that has no credential row', async () => {
    await setPassword(db, 'without', 'premier-mdp');
    const [row] = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, 'without'));
    expect(row?.providerId).toBe(CREDENTIAL_PROVIDER);
    expect(
      await verifyPassword({ hash: row?.password ?? '', password: 'premier-mdp' }),
    ).toBe(true);
  });
});
