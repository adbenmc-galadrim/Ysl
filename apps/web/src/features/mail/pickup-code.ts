import {
  newPickupToken,
  PICKUP_CODE_TTL_MS,
  PICKUP_PIN_LENGTH,
  pickupPinHash,
  pickupTokenHash,
} from '@repo/contract/pickup';
import { newId } from '@repo/shared/id';
import type { Upsert } from '#/features/db/commit';
import type { CourrierDatabase, LocalPickupCode } from '#/features/db/schema';

const PIN_SPACE = 10 ** PICKUP_PIN_LENGTH;

/** A whole number below `bound`, without the modulo's bias. */
export type RandomBelow = (bound: number) => number;

export const randomBelow: RandomBelow = (bound) => {
  const limit = Math.floor(0x1_0000_0000 / bound) * bound;
  const word = new Uint32Array(1);
  do crypto.getRandomValues(word);
  while (word[0]! >= limit);
  return word[0]! % bound;
};

function isLive(row: LocalPickupCode): boolean {
  return !row.deletedAt && !row.usedAt;
}

/**
 * `count` PINs for the mails about to be written, none already handed out
 * on this iPhone and all different, so a PIN typed at the desk names one
 * person. Two iPhones may still draw the same: the desk then asks the name.
 */
export async function drawPins(
  db: CourrierDatabase,
  count: number,
  { random = randomBelow, now = new Date() } = {},
): Promise<string[]> {
  const live = (await db.pickupCode.toArray()).filter(
    (row) => isLive(row) && row.expiresAt > now,
  );
  const taken = new Set(live.map((row) => row.pinHash));
  const pins: string[] = [];
  while (pins.length < count && taken.size < PIN_SPACE) {
    const pin = String(random(PIN_SPACE)).padStart(PICKUP_PIN_LENGTH, '0');
    const hash = await pickupPinHash(pin);
    if (taken.has(hash)) continue;
    taken.add(hash);
    pins.push(pin);
  }
  return pins;
}

/**
 * What the mail hands the employee: the PIN it quotes, the token its QR
 * carries. `codeId`: the recipient's code still open, quoted again by a
 * reminder; the PIN stays theirs.
 */
export type PickupSecret = { pin: string; token: string; codeId?: string };

/** `drawPins`, each with a token for its QR, kept in memory until the mail is written. */
export async function drawSecrets(
  db: CourrierDatabase,
  count: number,
  options: { random?: RandomBelow; now?: Date } = {},
): Promise<PickupSecret[]> {
  const pins = await drawPins(db, count, options);
  return pins.map((pin) => ({ pin, token: newPickupToken() }));
}

/**
 * The code a mail writes with it. A reminder quoting the open code (F37)
 * sent as text writes nothing: same PIN, and the QR of the first mail still
 * opens. Shared with its QR, the open code takes the new token.
 */
export function pickupToWrite(
  secret: PickupSecret | undefined,
  { withQr }: { withQr: boolean },
): PickupSecret | undefined {
  return secret?.codeId && !withQr ? undefined : secret;
}

export type PickupRecipient = {
  personId: string | null;
  contactId: string | null;
};

function codesOf(
  db: CourrierDatabase,
  { personId, contactId }: PickupRecipient,
): Promise<LocalPickupCode[]> {
  return personId
    ? db.pickupCode.where('personId').equals(personId).toArray()
    : contactId
      ? db.pickupCode.where('contactId').equals(contactId).toArray()
      : Promise.resolve([]);
}

let pinsByHash: Promise<Map<string, string>> | undefined;

/**
 * Every PIN by its hash: four digits are 10 000 hashes, worked out once.
 * Only the hash is kept (§8.7), yet a reminder must quote the code the
 * employee already holds (F37).
 */
function pinTable(): Promise<Map<string, string>> {
  pinsByHash ??= Promise.all(
    Array.from({ length: PIN_SPACE }, async (_, value) => {
      const pin = String(value).padStart(PICKUP_PIN_LENGTH, '0');
      return [await pickupPinHash(pin), pin] as const;
    }),
  ).then((pairs) => new Map(pairs));
  return pinsByHash;
}

/**
 * The secrets of a round of reminders: each recipient's open code (not
 * withdrawn, used nor expired), its PIN found again from its hash, so the
 * employee keeps the code of the first mail; a new PIN for whoever has none.
 * The token of the QR cannot be found again: each gets a new one.
 */
export async function recallSecrets(
  db: CourrierDatabase,
  recipients: readonly PickupRecipient[],
  options: { random?: RandomBelow; now?: Date } = {},
): Promise<PickupSecret[]> {
  const now = options.now ?? new Date();
  const pins = await pinTable();
  const open = await Promise.all(
    recipients.map(async (recipient) => {
      const latest = (await codesOf(db, recipient))
        .filter((row) => isLive(row) && row.expiresAt > now)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      const pin = latest && pins.get(latest.pinHash);
      return latest && pin ? { pin, codeId: latest.id } : undefined;
    }),
  );
  const drawn = await drawPins(
    db,
    open.filter((code) => !code).length,
    options,
  );
  return open.map((code) =>
    code
      ? { ...code, token: newPickupToken() }
      : { pin: drawn.shift()!, token: newPickupToken() },
  );
}

/**
 * The writes that make this PIN and token the recipient's code: the codes
 * still open for them go first, since the server allows one open code per
 * person (`pickup_code_active_person_idx`), then the new one. The last mail
 * sent holds the valid code. Only the hashes are written: the token lives
 * in the QR shared with the mail, or nowhere when the mail went as text.
 * A reminder that quotes the open code (`codeId`) keeps its PIN and its
 * date, with the QR's new token on a new code: the former one stays
 * withdrawn, so its QR says « replaced » at the desk, not « unknown ».
 */
export async function pickupCodeWrites(
  db: CourrierDatabase,
  recipient: PickupRecipient,
  secret: PickupSecret,
  { now = new Date() }: { now?: Date } = {},
): Promise<Upsert[]> {
  const { personId, contactId } = recipient;
  const mine = await codesOf(db, recipient);
  const kept = secret.codeId
    ? mine.find((row) => row.id === secret.codeId && isLive(row))
    : undefined;
  const { pin, token } = secret;
  const code: LocalPickupCode = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    personId,
    contactId: personId ? null : contactId,
    tokenHash: await pickupTokenHash(token),
    pinHash: kept?.pinHash ?? (await pickupPinHash(pin)),
    expiresAt: kept?.expiresAt ?? new Date(now.getTime() + PICKUP_CODE_TTL_MS),
    usedAt: null,
  };
  return [
    ...mine.filter(isLive).map((row): Upsert => ({
      entity: 'pickup_code',
      row: { ...row, deletedAt: now },
    })),
    { entity: 'pickup_code', row: code },
  ];
}
