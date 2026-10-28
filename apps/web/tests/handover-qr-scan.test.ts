import type { DecodeResult } from '@repo/barcode/worker';
import { describe, expect, it } from 'vitest';
import { readQrTexts } from '#/features/handover/qr-scan';
import { DecodeQueue } from '#/features/scan/decode-queue';

const bitmap = () => Promise.resolve({} as ImageBitmap);

const symbol = (format: string, text: string) => ({
  format,
  text,
  isValid: true,
  orientation: 0,
  position: {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
  },
});

describe('readQrTexts', () => {
  it('asks the Worker for QR codes and keeps only theirs', async () => {
    let asked: unknown;
    const queue = new DecodeQueue((_, options) => {
      asked = options;
      return Promise.resolve({
        symbols: [
          symbol('Code128', '1Z999AA10123456784'),
          symbol('QRCode', 'YSL:RETRAIT:ABC'),
        ],
      } as DecodeResult);
    });

    expect(await readQrTexts(queue, bitmap)).toEqual(['YSL:RETRAIT:ABC']);
    expect(asked).toEqual({ expect: ['QRCode'] });
  });

  it('gives the slot back when the Worker fails', async () => {
    const queue = new DecodeQueue(() => Promise.reject(new Error('busy')), 1);

    await expect(readQrTexts(queue, bitmap)).rejects.toThrow('busy');
    expect(queue.pending).toBe(0);
  });
});
