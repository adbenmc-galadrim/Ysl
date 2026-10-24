import { createTranslator } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import type { DraftParcel } from '#/features/db/schema';
import { lastOf } from '#/features/scan/last';

const t = createTranslator('fr');

const draft = (overrides: Partial<DraftParcel> = {}): DraftParcel => ({
  id: 'd1',
  batchId: 'b1',
  createdAt: new Date(0),
  photoId: null,
  reading: 'read',
  carrier: null,
  tracking: null,
  trackingNorm: null,
  readName: null,
  symbols: [],
  ocrState: 'pending',
  ocrName: null,
  ocrLines: [],
  ...overrides,
});

describe('lastOf', () => {
  it('says the reading is on its way', () => {
    expect(lastOf(draft({ reading: 'pending' }), t)).toEqual({
      name: 'Destinataire inconnu',
      meta: 'Lecture…',
    });
  });

  it('shows the carrier and the last four digits once read', () => {
    expect(
      lastOf(draft({ carrier: 'UPS', tracking: '1ZE6344W0499230622' }), t),
    ).toEqual({ name: 'Destinataire inconnu', meta: 'UPS ···0622' });
  });

  it('shows a typed number like a read one', () => {
    expect(
      lastOf(
        draft({
          reading: 'typed',
          carrier: 'UPS',
          tracking: '1ZE6344W0499230622',
        }),
        t,
      ).meta,
    ).toBe('UPS ···0622');
  });

  it('shows the name a code gave as is, the OCR guess with a doubt', () => {
    expect(
      lastOf(draft({ readName: 'Hugo Lefèvre', ocrName: 'Hugo Lefevre' }), t)
        .name,
    ).toBe('Hugo Lefèvre');
    expect(lastOf(draft({ ocrName: 'Camille Morel' }), t).name).toBe(
      'Camille Morel ?',
    );
  });

  it('names what it could not read', () => {
    expect(lastOf(draft({ reading: 'unreadable' }), t).meta).toBe(
      'Transporteur inconnu',
    );
  });
});
