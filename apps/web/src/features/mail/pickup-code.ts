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

/** What the mail hands the employee: the PIN it quotes, the token its QR carries. */
export type PickupSecret = { pin: string; token: string };

/** `drawPins`, each with a token for its QR, kept in memory until the mail is written. */
export async function drawSecrets(
  db: CourrierDatabase,
  count: number,
  options: { random?: RandomBelow; now?: Date } = {},
): Promise<PickupSecret[]> {
  const pins = await drawPins(db, count, options);
  return pins.map((pin) => ({ pin, token: newPickupToken() }));
}

export type PickupRecipient = {
  personId: string | null;
  contactId: string | null;
};

/**
 * The writes that make this PIN and token the recipient's code: the codes
 * still open for them go first, since the server allows one open code per
 * person (`pickup_code_active_person_idx`), then the new one. The last mail
 * sent holds the valid code. Only the hashes are written: the token lives
 * in the QR shared with the mail, or nowhere when the mail went as text.
 */
export async function pickupCodeWrites(
  db: CourrierDatabase,
  recipient: PickupRecipient,
  { pin, token }: PickupSecret,
  { now = new Date() }: { now?: Date } = {},
): Promise<Upsert[]> {
  const { personId, contactId } = recipient;
  const mine = personId
    ? await db.pickupCode.where('personId').equals(personId).toArray()
    : contactId
      ? await db.pickupCode.where('contactId').equals(contactId).toArray()
      : [];
  const code: LocalPickupCode = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    personId,
    contactId: personId ? null : contactId,
    tokenHash: await pickupTokenHash(token),
    pinHash: await pickupPinHash(pin),
    expiresAt: new Date(now.getTime() + PICKUP_CODE_TTL_MS),
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
