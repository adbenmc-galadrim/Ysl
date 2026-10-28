import {
  type PickupHashKind,
  pickupPinHash,
  type PickupRefusal,
  pickupTokenHash,
  pickupVerdict,
  type PickupVerifyInput,
  type PickupVerifyOutput,
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

/**
 * The server, when the network is there: `verify` is `pickup.verify`,
 * `sync` a synchronisation that brings its rows to this iPhone.
 */
export type OnlineCheck = {
  online: () => boolean;
  verify: (input: PickupVerifyInput) => Promise<PickupVerifyOutput>;
  sync: () => Promise<unknown>;
  /** How long the desk waits for an answer before it trusts its own copy. */
  waitMs?: number;
};

/** The longest wait for the server's verdict: past it, this iPhone decides. */
export const SERVER_CHECK_MS = 1_500;

/** The longest wait for the rows of a code the server knows and this iPhone not. */
export const SERVER_SYNC_MS = 5_000;

function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * The local verdict, then the server's when the network is there (§8.6):
 * a code `unknown` here may have just been issued on a colleague's iPhone
 * (its rows are pulled, then checked here again), one `active` here may
 * have been used on another since the last pull (the server's refusal
 * wins, for that very code). Offline, slow or failing, the server is not
 * asked or not waited for: the hashes of this iPhone decide (F41). Any
 * other refusal is final here, the server is not asked.
 */
export async function checkPickupCode(
  db: CourrierDatabase,
  kind: PickupHashKind,
  hash: string,
  check?: OnlineCheck,
  now = new Date(),
): Promise<PickupMatch> {
  const local = await findActivePickupCode(db, kind, hash, now);
  if (!check || (local.status !== 'unknown' && local.status !== 'active')) {
    return local;
  }
  if (!check.online()) return local;
  const server = await within(
    check.verify({ kind, hash }),
    check.waitMs ?? SERVER_CHECK_MS,
  );
  if (!server) return local;
  const { status, codeId } = server;
  if (local.status === 'active') {
    const closed =
      codeId === local.code.id && status !== 'active' && status !== 'ambiguous';
    if (!closed) return local;
    void check.sync().catch(() => undefined);
    return { status };
  }
  if (status !== 'active') return { status };
  await within(check.sync(), SERVER_SYNC_MS);
  return findActivePickupCode(db, kind, hash, now);
}

/** A scanned text: `notPickup` for any QR but a pickup one (a parcel label). */
export async function lookupPickupText(
  db: CourrierDatabase,
  text: string,
  now = new Date(),
  check?: OnlineCheck,
): Promise<PickupMatch | { status: 'notPickup' }> {
  const token = readPickupToken(text);
  if (!token) return { status: 'notPickup' };
  const hash = await pickupTokenHash(token);
  return checkPickupCode(db, 'token', hash, check, now);
}

/** A PIN typed at the desk. */
export async function lookupPickupPin(
  db: CourrierDatabase,
  pin: string,
  now = new Date(),
  check?: OnlineCheck,
): Promise<PickupMatch> {
  return checkPickupCode(db, 'pin', await pickupPinHash(pin), check, now);
}
