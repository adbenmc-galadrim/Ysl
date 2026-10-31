import type { AnyDb } from '@repo/db';
import { account } from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';

export { verifyPassword } from 'better-auth/crypto';

export const CREDENTIAL_PROVIDER = 'credential';

/** The credential row Better Auth reads at sign-in, written without its admin API. */
export async function credentialRow(userId: string, password: string) {
  return {
    id: newId(),
    accountId: userId,
    providerId: CREDENTIAL_PROVIDER,
    userId,
    password: await hashPassword(password),
    updatedAt: new Date(),
  };
}

/** Replaces the password; open sessions are the caller's decision, closing one empties a phone. */
export async function setPassword(
  db: AnyDb,
  userId: string,
  password: string,
): Promise<void> {
  const row = await credentialRow(userId, password);
  const updated = await db
    .update(account)
    .set({ password: row.password, updatedAt: row.updatedAt })
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, CREDENTIAL_PROVIDER),
      ),
    )
    .returning({ id: account.id });
  if (updated.length === 0) await db.insert(account).values(row);
}
