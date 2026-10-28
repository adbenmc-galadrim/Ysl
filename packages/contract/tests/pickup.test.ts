import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  newPickupToken,
  PICKUP_TOKEN_PREFIX,
  pickupPinHash,
  pickupTokenHash,
  readPickupToken,
} from '@repo/contract/pickup';

const sha256 = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

describe('the pickup token', () => {
  it('starts with the prefix and fits the QR alphanumeric mode', () => {
    const token = newPickupToken();
    expect(token.startsWith(PICKUP_TOKEN_PREFIX)).toBe(true);
    expect(token).toMatch(/^[0-9A-Z $%*+\-./:]+$/);
    expect(token).toHaveLength(PICKUP_TOKEN_PREFIX.length + 32);
    expect(newPickupToken()).not.toBe(token);
  });

  it('encodes its bytes in base32', () => {
    const token = newPickupToken((bytes) => void bytes.fill(0xff));
    expect(token).toBe(`${PICKUP_TOKEN_PREFIX}${'7'.repeat(32)}`);
    expect(newPickupToken((bytes) => void bytes.fill(0))).toBe(
      `${PICKUP_TOKEN_PREFIX}${'A'.repeat(32)}`,
    );
  });

  it('reads back a scanned token whatever its case and spaces', () => {
    const token = newPickupToken();
    expect(readPickupToken(` ${token.toLowerCase()}\n`)).toBe(token);
  });

  it('refuses a parcel label, another QR or a cut token', () => {
    const token = newPickupToken();
    expect(readPickupToken('1Z999AA10123456784')).toBeNull();
    expect(readPickupToken('https://ysl.shinseo.fr/installer')).toBeNull();
    expect(readPickupToken(token.slice(0, -1))).toBeNull();
    expect(readPickupToken(`${token}A`)).toBeNull();
  });
});

describe('the hashes a desk checks offline', () => {
  it('hashes the PIN as the codes written since YSL-61 did', async () => {
    expect(await pickupPinHash('4821')).toBe(sha256('pickup:4821'));
  });

  it('hashes the canonical token, the text the QR carries', async () => {
    const token = newPickupToken();
    expect(await pickupTokenHash(token)).toBe(sha256(token));
    expect(await pickupTokenHash(token)).toBe(
      await pickupTokenHash(readPickupToken(token.toLowerCase())!),
    );
  });
});
