import { newId } from '@repo/shared/id';
import type { Upsert } from '#/features/db/commit';
import type { CourrierDatabase, LocalPickupCode } from '#/features/db/schema';
import { sha256Hex } from '#/features/photos/sha256';

/** Four digits, as the mockups and the Remise keypad say ("Code à 4 chiffres"). */
export const PICKUP_PIN_LENGTH = 4;

const PIN_SPACE = 10 ** PICKUP_PIN_LENGTH;

/** A code lives a month; the reminder of a later mail issues the next one. */
export const PICKUP_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * What every iPhone keeps of a PIN (F41: checked offline at the desk). Four
 * digits hide nothing from whoever holds the hash; it only keeps the code
 * out of plain sight in the database and the exports.
 */
export function pinHash(pin: string): Promise<string> {
  return sha256Hex(new Blob([`pickup:${pin}`]));
}

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
    const hash = await pinHash(pin);
    if (taken.has(hash)) continue;
    taken.add(hash);
    pins.push(pin);
  }
  return pins;
}

export type PickupRecipient = {
  personId: string | null;
  contactId: string | null;
};

/**
 * The writes that make `pin` the recipient's code: the codes still open
 * for them go first, since the server allows one open code per person
 * (`pickup_code_active_person_idx`), then the new one. The last mail sent
 * holds the valid code. The QR's token is drawn and dropped: the QR itself
 * comes with the final template (YSL-66).
 */
export async function pickupCodeWrites(
  db: CourrierDatabase,
  recipient: PickupRecipient,
  pin: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<Upsert[]> {
  const { personId, contactId } = recipient;
  const mine = personId
    ? await db.pickupCode.where('personId').equals(personId).toArray()
    : contactId
      ? await db.pickupCode.where('contactId').equals(contactId).toArray()
      : [];
  const token = new Uint8Array(32);
  crypto.getRandomValues(token);
  const code: LocalPickupCode = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    personId,
    contactId: personId ? null : contactId,
    tokenHash: await sha256Hex(new Blob([token])),
    pinHash: await pinHash(pin),
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
