import { readSymbols } from '@repo/barcode';
import { initZxingNode } from '@repo/barcode/node';
import { newPickupToken, readPickupToken } from '@repo/contract/pickup';
import { beforeAll, describe, expect, it } from 'vitest';
import { pickupQrModules } from '#/features/mail/pickup-qr';
import { qrRaster } from './helpers/qr-raster';

describe('the pickup QR', () => {
  beforeAll(async () => {
    await initZxingNode();
  });

  it('reads back as the token the desk will look for', async () => {
    const token = newPickupToken();

    const [symbol] = await readSymbols(qrRaster(pickupQrModules(token)));

    expect(symbol?.format).toBe('QRCode');
    expect(readPickupToken(symbol?.text ?? '')).toBe(token);
  }, 30_000);

  it('stays a small code, the token fitting the alphanumeric mode', () => {
    expect(pickupQrModules(newPickupToken())).toHaveLength(29 + 8);
  });
});
