import { describe, expect, it } from 'vitest';
import { EOT, GS, RS } from '@repo/contract/codes';
import {
  CONFIDENCE,
  elsewhere,
  extractFields,
  extractRecipient,
  ocrTrackings,
} from '@repo/contract/extract';

import { FIRST_CLIENT } from './fixtures/first-client';

const UPS = '1Z12345E0205271686';
const DHL = '5413337112';
const FEDEX = '877974873338';
const DPD = '01234567890128';

const dpdAztec = (
  recipient: string,
  postal = '75007',
  country = '250',
  network = 'GEOP',
) =>
  `[)>${RS}01${GS}02${GS}${postal}${GS}${country}${GS}328${GS}${DPD}${GS}${network}${GS}123456${GS}${GS}${GS}001/001${GS}01.50KG${GS}N${GS}24 RUE DE L UNIVERSITE${GS}PARIS${GS}${GS}${recipient}${GS}${RS}${EOT}`;

describe('O1 — a tracking without a valid key is never sure', () => {
  it('caps a DHL Express number read without context', () => {
    const { tracking } = extractFields({
      symbols: [{ format: 'Code128', text: DHL }],
    });
    expect(tracking).toMatchObject({
      value: DHL,
      level: 'to-verify',
      flags: ['unkeyed'],
    });
    expect(tracking!.confidence).toBeLessThan(CONFIDENCE.sure);
  });

  it('keeps two key-less sources that agree below « sûr »', () => {
    const { tracking } = extractFields({
      symbols: [{ format: 'Code128', text: DHL }],
      ocr: { text: `WAYBILL ${DHL.slice(0, 5)} ${DHL.slice(5)}` },
    });
    expect(tracking?.sources).toHaveLength(2);
    expect(tracking).toMatchObject({
      value: DHL,
      confidence: CONFIDENCE.unkeyedCap,
      level: 'to-verify',
      flags: ['unkeyed'],
    });
  });

  it('caps a format-only number, whatever the code it came from', () => {
    const { tracking } = extractFields({
      symbols: [{ format: 'Code128', text: DPD }],
    });
    expect(tracking?.confidence).toBeLessThan(CONFIDENCE.sure);
    expect(tracking?.flags).toContain('unkeyed');
  });

  it('caps a Chronopost number its context makes « sure » without a key', () => {
    const { tracking, carrier } = extractFields({
      symbols: [
        {
          format: 'Aztec',
          text: dpdAztec('MARIE CURIE', '75007', '250', 'CHRO'),
        },
        { format: 'Code128', text: 'HA915306631JB' },
      ],
    });
    expect(carrier).toMatchObject({ value: 'chronopost', level: 'sure' });
    expect(tracking?.value).toBe('HA915306631JB');
    expect(tracking?.sources[0]?.confidence).toBe(CONFIDENCE.keyed1d);
    expect(tracking?.candidates[0]?.confidence).toBe(CONFIDENCE.unkeyedCap);
    expect(tracking?.flags).toContain('unkeyed');
    expect(tracking?.level).not.toBe('sure');
  });

  it('never reads the v1 false FedEx 7185713569 as sure', () => {
    for (const read of [
      { symbols: [{ format: 'Code128', text: '7185713569' }] },
      { symbols: [], ocr: { text: 'TRACKING 7185713569' } },
      {
        symbols: [{ format: 'Code128', text: UPS }],
        ocr: { text: 'FEDEX 7185713569' },
      },
    ]) {
      const { tracking } = extractFields(read);
      expect(tracking?.value).not.toBe('7185713569');
      expect(
        tracking?.candidates.some((c) => c.value === '7185713569') ?? false,
      ).toBe(false);
    }
  });

  it('lets a keyed number read by a code and by the OCR reach the cap', () => {
    const { tracking } = extractFields({
      symbols: [{ format: 'Code128', text: UPS }],
      ocr: { text: 'TRACKING #: 1Z 12345E 02 0527 1686' },
    });
    expect(tracking).toMatchObject({
      value: UPS,
      confidence: CONFIDENCE.cap,
      level: 'sure',
      flags: [],
    });
  });
});

describe('ocrTrackings — §4.3 ranks 5 and 6', () => {
  it('reads a printed number with its key at 0.85, grouped or not', () => {
    const found = ocrTrackings(`SHIP 8779 7487 3338\nREF 12`);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      value: FEDEX,
      keyed: true,
      source: { kind: 'ocr', confidence: 0.85 },
    });
  });

  it('reads a known format without its key at 0.65', () => {
    const found = ocrTrackings(DHL);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      value: DHL,
      keyed: false,
      source: { confidence: 0.65 },
    });
  });

  it('drops a number whose key fails', () => {
    expect(ocrTrackings('1Z12345E0205271687')).toEqual([]);
  });

  it('takes a keyed printed number as the tracking when no code gave one, to verify', () => {
    const { tracking } = extractFields({
      symbols: [],
      ocr: { text: `TRACKING ${UPS}` },
    });
    expect(tracking).toMatchObject({
      value: UPS,
      confidence: CONFIDENCE.ocrKeyed,
      level: 'to-verify',
      flags: [],
    });
  });

  it('never proposes a key-less printed number on its own', () => {
    const { tracking } = extractFields({
      symbols: [],
      ocr: { text: `TEL ${DHL}` },
    });
    expect(tracking).toBeNull();
  });

  it('never lets another printed number contradict the code', () => {
    const { tracking } = extractFields({
      symbols: [{ format: 'Code128', text: UPS }],
      ocr: { text: `ACCOUNT ${FEDEX}` },
    });
    expect(tracking).toMatchObject({
      value: UPS,
      confidence: CONFIDENCE.keyed1d,
      flags: [],
    });
  });
});

describe('recipient — business checks of §4.3', () => {
  it('reads the recipient of a code addressed to the mailroom as sure', () => {
    const { recipient } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec('MARIE CURIE') }],
    });
    expect(recipient).toMatchObject({
      value: 'MARIE CURIE',
      confidence: CONFIDENCE.structured2d,
      level: 'sure',
      flags: [],
    });
  });

  it('asks « réexpédition ? » for a code addressed outside 75007', () => {
    const { recipient } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec('MARIE CURIE', '69002') }],
      reception: FIRST_CLIENT,
    });
    expect(recipient).toMatchObject({
      confidence: 0.82,
      level: 'to-verify',
      flags: ['forward'],
    });
  });

  it('asks nothing of a company that has not set its address', () => {
    const { recipient } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec('MARIE CURIE', '69002') }],
    });
    expect(recipient).toMatchObject({ level: 'sure', flags: [] });
  });

  it('compares a label to the address of its own company', () => {
    const lyon = { postalCode: '69002' };
    const read = (reception: { postalCode: string }) =>
      extractFields({
        symbols: [{ format: 'Aztec', text: dpdAztec('MARIE CURIE', '69002') }],
        reception,
      }).recipient?.flags;
    expect(read(lyon)).toEqual([]);
    expect(read(FIRST_CLIENT)).toEqual(['forward']);
  });

  it('tells the mailroom country from another', () => {
    expect(elsewhere({ postalCode: '75007', country: 'FR' }, FIRST_CLIENT)).toBe(
      false,
    );
    expect(elsewhere({ postalCode: '75 007', country: '250' }, FIRST_CLIENT)).toBe(
      false,
    );
    expect(elsewhere({ postalCode: '75007', country: '276' }, FIRST_CLIENT)).toBe(
      true,
    );
    expect(elsewhere({ name: 'MARIE CURIE' }, FIRST_CLIENT)).toBe(false);
    expect(elsewhere({ postalCode: '69002' }, null)).toBe(false);
  });

  it('takes the OCR name close to the code name as the same reading', () => {
    const { recipient } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec('MARIE CURIE') }],
      ocr: { text: 'SHIP TO MARIE CURLE', recipientName: 'MARIE CURLE' },
    });
    expect(recipient).toMatchObject({
      value: 'MARIE CURIE',
      confidence: CONFIDENCE.cap,
      flags: [],
    });
    expect(recipient?.sources).toHaveLength(2);
  });

  it('keeps the code name with a malus when the OCR names someone else', () => {
    const { recipient } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec('MARIE CURIE') }],
      ocr: { text: 'SHIP TO PAUL LANGEVIN', recipientName: 'PAUL LANGEVIN' },
    });
    expect(recipient).toMatchObject({
      value: 'MARIE CURIE',
      confidence: 0.82,
      level: 'to-verify',
      flags: ['conflict'],
    });
  });

  it('reads an anchored OCR name at 0.65, raised by a directory match', () => {
    const ocr = { text: 'SHIP TO LEA FONTAINE', recipientName: 'LEA FONTAINE' };
    expect(extractFields({ symbols: [], ocr }).recipient).toMatchObject({
      confidence: CONFIDENCE.ocrFormat,
      level: 'to-verify',
    });
    expect(
      extractFields({ symbols: [], ocr, directory: ['Léa Fontaine'] })
        .recipient,
    ).toMatchObject({ confidence: 0.75, level: 'to-verify' });
  });

  it('gives no bonus to a name the directory only resembles', () => {
    const field = extractRecipient(
      [
        {
          name: 'L FONTAIN',
          source: { kind: 'ocr', format: 'block', confidence: 0.65, value: '' },
        },
      ],
      ['Louis Martin'],
    );
    expect(field?.confidence).toBe(CONFIDENCE.ocrFormat);
  });
});
