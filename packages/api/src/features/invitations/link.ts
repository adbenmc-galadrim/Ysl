import { createHash, randomBytes } from 'node:crypto';
import { INVITATION_DAYS } from '@repo/contract/accounts';
import type { AnyDb } from '@repo/db';
import { accountInvitation } from '@repo/db/schema';
import { env } from '@repo/shared/env/server';
import { newId } from '@repo/shared/id';

const DAY_MS = 24 * 60 * 60 * 1000;

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * The web app's origin, the only one the server knows. The token rides in the
 * fragment: no server, proxy or referrer ever sees it.
 */
export const linkTo = (token: string): string =>
  `${env.CORS_ORIGIN}/invitation#${token}`;

type Writer = Pick<AnyDb, 'insert'>;

/** A new link for the account: the previous one, used or not, stops working. */
export async function issueLink(
  db: Writer,
  account: { userId: string; organizationId: string },
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITATION_DAYS * DAY_MS);
  const replaced = {
    tokenHash: hashToken(token),
    expiresAt,
    usedAt: null,
    createdAt: now,
  };
  await db
    .insert(accountInvitation)
    .values({ id: newId(), ...account, ...replaced })
    .onConflictDoUpdate({
      target: accountInvitation.userId,
      set: { organizationId: account.organizationId, ...replaced },
    });
  return { token, expiresAt };
}
