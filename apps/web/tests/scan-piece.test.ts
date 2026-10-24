import { createTranslator } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import type { DraftParcel } from '#/features/db/schema';
import { pieceReading } from '#/features/scan/piece';

const t = createTranslator('fr');

const group: DraftParcel = {
  id: 'g',
  batchId: 'b',
  createdAt: new Date(0),
  photoId: 'p1',
  reading: 'read',
  carrier: 'UPS',
  tracking: '1ZE6344W0499230622',
  trackingNorm: '1ZE6344W0499230622',
  readName: 'Camille Morel',
  symbols: [],
  ocrState: 'skipped',
  ocrName: null,
  ocrLines: [],
  pieces: { total: 3, read: [1, 2], key: 'ups:SHIP42', photoIds: ['p2'] },
};

describe('pieceReading', () => {
  it('names the parcel the piece joined and where its pieces stand', () => {
    expect(pieceReading(group, group.pieces!, 2, t)).toEqual({
      kind: 'piece',
      last: { name: 'Camille Morel', meta: 'UPS ···0622' },
      pieces: { total: 3, read: [1, 2], index: 2 },
    });
  });

  it('flags a parcel whose number or carrier is missing, as the band does', () => {
    const bare = { ...group, carrier: null, readName: null };
    expect(pieceReading(bare, group.pieces!, 1, t).last).toEqual({
      name: 'Destinataire inconnu',
      meta: 'Transporteur inconnu ···0622',
      status: 'warning',
    });
  });
});
