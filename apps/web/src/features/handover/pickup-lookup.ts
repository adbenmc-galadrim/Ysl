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
import type { TranslateFn } from '@repo/shared/i18n';
import type { CourrierDatabase, LocalPickupCode } from '#/features/db/schema';

export {
  isActiveCode,
  type PickupHashKind,
  type PickupRefusal,
} from '@repo/contract/pickup';

/**
 * What a QR or a PIN opens. `active` names who collects; the others say
 * why not, so the desk tells an old mail from a typo (`PickupRefusal`), and
 * `other_department` where the code does open.
 */
export type PickupMatch = LocalMatch | OtherDepartment;

/** What this iPhone can tell by itself. */
export type LocalMatch =
  { status: 'active'; code: LocalPickupCode } | { status: PickupRefusal };

/** Open in another department, as the server alone can tell (§3.7.9). */
export type OtherDepartment = {
  status: 'other_department';
  elsewhere: NonNullable<PickupVerifyOutput['elsewhere']>;
};

/** What the desk says of a code that opens at another counter. */
export function elsewhereLines(
  { department, location, name }: OtherDepartment['elsewhere'],
  via: 'qr' | 'pin',
  t: TranslateFn,
) {
  return {
    title: t(`handover.elsewhere.${via}`, { department }),
    description:
      name && location
        ? t('handover.elsewhere.named', { name, location })
        : location
          ? t('handover.elsewhere.place', { location })
          : t('handover.elsewhere.nowhere'),
  };
}

const refusalOf = ({
  status,
  elsewhere,
}: PickupVerifyOutput): Exclude<PickupMatch, { status: 'active' }> => {
  if (status === 'other_department') {
    return elsewhere ? { status, elsewhere } : { status: 'unknown' };
  }
  return { status: status === 'active' ? 'unknown' : status };
};

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
): Promise<LocalMatch> {
  const rows =
    kind === 'token'
      ? await db.pickupCode.where('tokenHash').equals(hash).toArray()
      : await db.pickupCode.filter((row) => row.pinHash === hash).toArray();
  const verdict = pickupVerdict(rows, now);
  if (verdict.status === 'active' && (await outOfReach(db, verdict.code))) {
    return { status: 'unknown' };
  }
  return verdict;
}

/**
 * A copy of a code this iPhone cannot open: a department pulls only itself, so
 * a code of a department it does not hold was left by a move (§3.7.9). Before
 * the first pull of the departments, nothing can be told.
 */
async function outOfReach(db: CourrierDatabase, code: LocalPickupCode) {
  if (!code.departmentId) return false;
  const held = await db.department.get(code.departmentId);
  return !held && (await db.department.count()) > 0;
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
 * wins, for that very code, and the pull runs behind it: the desk shows
 * the refusal at once). Offline, slow or failing, the server is not
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
    check.verify({ kind, hash, elsewhere: true }),
    check.waitMs ?? SERVER_CHECK_MS,
  );
  if (!server) return local;
  const { status, codeId } = server;
  if (local.status === 'active') {
    const closed =
      codeId === local.code.id && status !== 'active' && status !== 'ambiguous';
    if (!closed) return local;
    void check.sync().catch(() => undefined);
    return refusalOf(server);
  }
  if (status !== 'active') return refusalOf(server);
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
