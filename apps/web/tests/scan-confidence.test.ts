import { EOT, GS, RS } from '@repo/contract/codes';
import { describe, expect, it } from 'vitest';
import type { DraftParcel } from '#/features/db/schema';
import {
  draftFields,
  notifiable,
  trackingToCheck,
} from '#/features/scan/confidence';

const UPS = '1ZE6344W0499230622';

const dpdAztec = (recipient: string) =>
  `[)>${RS}01${GS}02${GS}75007${GS}250${GS}328${GS}01234567890128${GS}GEOP${GS}123456${GS}${GS}${GS}001/001${GS}01.50KG${GS}N${GS}24 RUE DE L UNIVERSITE${GS}PARIS${GS}${GS}${recipient}${GS}${RS}${EOT}`;

const draft = (overrides: Partial<DraftParcel>): DraftParcel => ({
  id: 'd',
  batchId: 'b',
  createdAt: new Date(0),
  photoId: null,
  reading: 'read',
  carrier: 'UPS',
  tracking: UPS,
  trackingNorm: UPS,
  readName: null,
  symbols: [{ format: 'Code128', text: UPS }],
  ocrState: 'done',
  ocrName: null,
  ocrLines: [],
  ...overrides,
});

const line = (text: string) => ({
  text,
  score: 0.9,
  box: { x: 0, y: 0, width: 1, height: 1 },
});

describe('draftFields', () => {
  it('scores the number the draft keeps, sure with its key', () => {
    expect(draftFields(draft({})).tracking).toMatchObject({
      value: UPS,
      level: 'sure',
    });
  });

  it('reads the OCR name at « à vérifier », never sure on its own', () => {
    const { recipient } = draftFields(draft({ ocrName: 'Camille Morel' }));
    expect(recipient).toMatchObject({
      value: 'Camille Morel',
      level: 'to-verify',
    });
  });

  it('takes the name the agent copied from the parcel before as sure', () => {
    expect(
      draftFields(draft({ readName: 'Camille Morel' })).recipient,
    ).toMatchObject({ level: 'sure', sources: [{ kind: 'agent' }] });
  });

  it('downgrades a code name the printed text contradicts', () => {
    const symbols = [{ format: 'Aztec', text: dpdAztec('MARIE CURIE') }];
    const read = draft({
      readName: 'MARIE CURIE',
      symbols,
      ocrName: 'PAUL LANGEVIN',
      ocrLines: [line('PAUL LANGEVIN')],
    });
    expect(draftFields(read).recipient).toMatchObject({
      value: 'MARIE CURIE',
      level: 'to-verify',
      flags: ['conflict'],
    });
    expect(notifiable(read)).toBe(false);
    expect(
      notifiable({
        ...read,
        ocrName: null,
        ocrLines: [],
        recipient: {
          kind: 'person',
          id: 'p',
          name: 'Marie Curie',
          source: 'code',
        },
      }),
    ).toBe(true);
  });
});

describe('trackingToCheck', () => {
  const DHL = '5413337112';
  const unsure = draft({
    carrier: 'DHL Express',
    tracking: DHL,
    trackingNorm: DHL,
    symbols: [{ format: 'Code128', text: DHL }],
  });

  it('asks the agent about a number below « sûr », not about a keyed one', () => {
    expect(trackingToCheck(unsure)).toBe(true);
    expect(trackingToCheck(draft({}))).toBe(false);
    expect(trackingToCheck({ ...unsure, trackingConfirmed: true })).toBe(false);
  });
});
