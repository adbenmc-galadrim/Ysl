import {
  pickupPinHash,
  pickupTokenHash,
  readPickupToken,
} from '@repo/contract/pickup';
import type { CourrierDatabase, LocalPickupCode } from '#/features/db/schema';

/** What the desk holds of a code: the hash of the QR's token, or of the PIN. */
export type PickupHashKind = 'token' | 'pin';

/**
 * What a QR or a PIN opens. Only `active` names someone; the others say
 * why not, so the desk tells an old mail from a typo: `replaced` by a later
 * mail, `used` for a handover, `expired` after 30 days, `ambiguous` when
 * two iPhones drew the same PIN (the name settles it).
 */
export type PickupMatch =
  { status: 'active'; code: LocalPickupCode } | { status: PickupRefusal };

export type PickupRefusal =
  'ambiguous' | 'expired' | 'used' | 'replaced' | 'unknown';

/** Open, in date and pointing at someone: the code a handover may rest on. */
export function isActiveCode(row: LocalPickupCode, now: Date): boolean {
  return (
    !row.deletedAt &&
    !row.usedAt &&
    row.expiresAt > now &&
    Boolean(row.personId || row.contactId)
  );
}

function whyNot(row: LocalPickupCode): PickupRefusal {
  if (row.usedAt) return 'used';
  if (row.deletedAt) return 'replaced';
  return 'expired';
}

/**
 * The code behind a hash, checked on this iPhone only (F41): the synced
 * hashes are the check, nothing goes to the server. An active code wins
 * over older ones of the same hash, which a 4-digit PIN will meet; with
 * none active, the latest says why. Entry point of the handover (YSL-73
 * marks the code used).
 */
export async function findActivePickupCode(
  db: CourrierDatabase,
  kind: PickupHashKind,
  hash: string,
  now = new Date(),
): Promise<PickupMatch> {
  const rows =
    kind === 'token'
      ? await db.pickupCode.where('tokenHash').equals(hash).toArray()
      : await db.pickupCode.filter((row) => row.pinHash === hash).toArray();
  const active = rows.filter((row) => isActiveCode(row, now));
  if (active.length === 1) return { status: 'active', code: active[0]! };
  if (active.length > 1) return { status: 'ambiguous' };
  const latest = rows.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
  return { status: latest ? whyNot(latest) : 'unknown' };
}

/** A scanned text: `notPickup` for any QR but a pickup one (a parcel label). */
export async function lookupPickupText(
  db: CourrierDatabase,
  text: string,
  now = new Date(),
): Promise<PickupMatch | { status: 'notPickup' }> {
  const token = readPickupToken(text);
  if (!token) return { status: 'notPickup' };
  return findActivePickupCode(db, 'token', await pickupTokenHash(token), now);
}

/** A PIN typed at the desk. */
export async function lookupPickupPin(
  db: CourrierDatabase,
  pin: string,
  now = new Date(),
): Promise<PickupMatch> {
  return findActivePickupCode(db, 'pin', await pickupPinHash(pin), now);
}
