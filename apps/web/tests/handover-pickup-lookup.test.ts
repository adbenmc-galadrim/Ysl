import 'fake-indexeddb/auto';
import { readSymbols } from '@repo/barcode';
import { initZxingNode } from '@repo/barcode/node';
import {
  newPickupToken,
  PICKUP_CODE_TTL_MS,
  pickupPinHash,
  pickupTokenHash,
} from '@repo/contract/pickup';
import { newId } from '@repo/shared/id';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalPickupCode } from '#/features/db/schema';
import {
  findActivePickupCode,
  lookupPickupPin,
  lookupPickupText,
} from '#/features/handover/pickup-lookup';
import { pickupQrModules } from '#/features/mail/pickup-qr';
import { qrRaster } from './helpers/qr-raster';
import { NOW, openTestDatabase } from './helpers/local-rows';

async function codeRow(
  { token = newPickupToken(), pin = '4821' } = {},
  overrides: Partial<LocalPickupCode> = {},
): Promise<LocalPickupCode> {
  return {
    id: newId(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    personId: newId(),
    contactId: null,
    tokenHash: await pickupTokenHash(token),
    pinHash: await pickupPinHash(pin),
    expiresAt: new Date(NOW.getTime() + PICKUP_CODE_TTL_MS),
    usedAt: null,
    ...overrides,
  };
}

const LATER = new Date(NOW.getTime() + 60 * 1000);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('the pickup QR at the desk', () => {
  beforeAll(async () => {
    await initZxingNode();
  });

  it('reads the QR of the mail back to its recipient’s open code', async () => {
    const token = newPickupToken();
    const code = await codeRow({ token });
    await db.pickupCode.put(code);

    const [symbol] = await readSymbols(qrRaster(pickupQrModules(token)));
    const match = await lookupPickupText(db, symbol?.text ?? '', LATER);

    expect(match).toEqual({ status: 'active', code });
  }, 30_000);

  it('tells a parcel label from a pickup QR', async () => {
    expect(await lookupPickupText(db, '1Z999AA10123456784', LATER)).toEqual({
      status: 'notPickup',
    });
  });
});

describe('findActivePickupCode', () => {
  it('says why a code opens nothing: used, replaced, expired, unknown', async () => {
    const used = await codeRow({}, { usedAt: NOW });
    const replaced = await codeRow({}, { deletedAt: NOW });
    const expired = await codeRow({}, { expiresAt: NOW });
    await db.pickupCode.bulkPut([used, replaced, expired]);

    const status = async (row: LocalPickupCode) =>
      (await findActivePickupCode(db, 'token', row.tokenHash, LATER)).status;

    expect(await status(used)).toBe('used');
    expect(await status(replaced)).toBe('replaced');
    expect(await status(expired)).toBe('expired');
    expect(
      (await findActivePickupCode(db, 'token', 'f'.repeat(64), LATER)).status,
    ).toBe('unknown');
  });

  it('opens the open code of a PIN an older code also had', async () => {
    const old = await codeRow(
      {},
      { usedAt: NOW, createdAt: new Date(NOW.getTime() - 1000) },
    );
    const current = await codeRow();
    await db.pickupCode.bulkPut([old, current]);

    expect(await lookupPickupPin(db, '4821', LATER)).toEqual({
      status: 'active',
      code: current,
    });
  });

  it('asks for the name when two open codes share the PIN', async () => {
    await db.pickupCode.bulkPut([await codeRow(), await codeRow()]);

    expect((await lookupPickupPin(db, '4821', LATER)).status).toBe('ambiguous');
  });

  it('says why from the latest code when none is open', async () => {
    await db.pickupCode.bulkPut([
      await codeRow(
        {},
        { deletedAt: NOW, createdAt: new Date(NOW.getTime() - 1000) },
      ),
      await codeRow({}, { usedAt: NOW }),
    ]);

    expect((await lookupPickupPin(db, '4821', LATER)).status).toBe('used');
  });
});
