/**
 * What an employee shows at the desk to collect their parcels (§8.7, F40,
 * F41): a QR carrying a long token, or a 4-digit PIN said aloud. Every
 * iPhone keeps only the hashes, synced ahead, so the desk checks either
 * offline; the token and the PIN themselves live in the mail.
 */

/** Four digits, as the mockups and the Remise keypad say ("Code à 4 chiffres"). */
export const PICKUP_PIN_LENGTH = 4;

/** A code lives a month; the reminder of a later mail issues the next one. */
export const PICKUP_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * What a pickup QR starts with, so the reader of the Remise tab tells it
 * from a parcel's label. Upper case: with base32, the whole text fits the
 * QR's alphanumeric mode and the code stays small enough to read off a
 * phone screen.
 */
export const PICKUP_TOKEN_PREFIX = 'YSL:RETRAIT:';

/** 160 bits: out of reach of guessing, 32 characters of base32. */
export const PICKUP_TOKEN_BYTES = 20;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

const TOKEN = new RegExp(
  `^${PICKUP_TOKEN_PREFIX}[${BASE32}]{${Math.ceil((PICKUP_TOKEN_BYTES * 8) / 5)}}$`,
);

/** A fresh token, as the QR carries it: `YSL:RETRAIT:` and 32 characters. */
export function newPickupToken(
  fill: (bytes: Uint8Array<ArrayBuffer>) => void = (bytes) => {
    crypto.getRandomValues(bytes);
  },
): string {
  const bytes = new Uint8Array(PICKUP_TOKEN_BYTES);
  fill(bytes);
  return PICKUP_TOKEN_PREFIX + base32(bytes);
}

/**
 * The token a scanned text holds, in its canonical form, or null when it
 * is anything else (a parcel's label, another QR). Case and surrounding
 * spaces do not matter: a reader may hand either.
 */
export function readPickupToken(text: string): string | null {
  const token = text.trim().toUpperCase();
  return TOKEN.test(token) ? token : null;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/** `pickup_code.tokenHash`: what the desk compares a scanned QR with. */
export function pickupTokenHash(token: string): Promise<string> {
  return sha256Hex(token);
}

/**
 * `pickup_code.pinHash`. Four digits hide nothing from whoever holds the
 * hash; it only keeps the code out of plain sight in the database and the
 * exports (§8.7, known limit).
 */
export function pickupPinHash(pin: string): Promise<string> {
  return sha256Hex(`pickup:${pin}`);
}
