import {
  type PickupHashKind,
  pickupPinHash,
  type PickupRefusal,
  pickupTokenHash,
  pickupVerdict,
  readPickupToken,
} from '@repo/contract/pickup';
import type { CourrierDatabase, LocalPickupCode } from '#/features/db/schema';

export {
  isActiveCode,
  type PickupHashKind,
  type PickupRefusal,
} from '@repo/contract/pickup';

/**
 * What a QR or a PIN opens. Only `active` names someone; the others say
 * why not, so the desk tells an old mail from a typo (`PickupRefusal`).
 */
export type PickupMatch =
  { status: 'active'; code: LocalPickupCode } | { status: PickupRefusal };

/**
 * The code behind a hash, checked on this iPhone only (F41): the synced
 * hashes are the check, nothing goes to the server (`pickupVerdict`, the
 * same rule as `pickup.verify`). Entry point of the handover.
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
  return pickupVerdict(rows, now);
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
