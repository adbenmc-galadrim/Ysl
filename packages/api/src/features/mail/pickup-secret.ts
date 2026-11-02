import type { AnyDb } from '@repo/db';
import { pickupCode, pickupSecret } from '@repo/db/schema';
import { env } from '@repo/shared/env/server';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { inArray, isNotNull, lt, or } from 'drizzle-orm';
import { REQUEST_MAX_AGE_MS } from '#features/mail/settle';

const IV_BYTES = 12;
const TAG_BYTES = 16;

export type PickupClear = { pin: string; token: string };

function key(): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      env.BETTER_AUTH_SECRET,
      '',
      'courrier.pickup-secret',
      32,
    ),
  );
}

/** Bound to its code: a sealed value moved to another row does not open. */
export function sealPickupSecret(codeId: string, clear: PickupClear): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(codeId));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(clear), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

/** Nothing when it does not open: the auth secret changed, or it is not this code's. */
export function openPickupSecret(
  codeId: string,
  sealed: string,
): PickupClear | null {
  try {
    const raw = Buffer.from(sealed, 'base64');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key(),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAAD(Buffer.from(codeId));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const clear = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(clear) as PickupClear;
  } catch {
    return null;
  }
}

/**
 * A closed code needs no secret. A withdrawn one waits out the mail that took
 * over from it: if that mail fails, the code comes back (`settleFailed`).
 */
export async function forgetClosedSecrets(db: AnyDb, now: Date): Promise<void> {
  const withdrawnBefore = new Date(now.getTime() - REQUEST_MAX_AGE_MS);
  const closed = db
    .select({ id: pickupCode.id })
    .from(pickupCode)
    .where(
      or(
        isNotNull(pickupCode.usedAt),
        lt(pickupCode.expiresAt, now),
        lt(pickupCode.deletedAt, withdrawnBefore),
      ),
    );
  await db.delete(pickupSecret).where(inArray(pickupSecret.codeId, closed));
}
