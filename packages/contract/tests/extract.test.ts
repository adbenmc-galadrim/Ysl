import { describe, expect, it } from 'vitest';
import { EOT, GS, RS } from '@repo/contract/codes';
import {
  CONFIDENCE,
  combine,
  extractFields,
  levelOf,
} from '@repo/contract/extract';

const dpdAztec = (
  tracking: string,
  recipient = 'MARIE CURIE',
  network: 'GEOP' | 'CHRO' = 'GEOP',
) =>
  `[)>${RS}01${GS}02${GS}75007${GS}250${GS}328${GS}${tracking}${GS}${network}${GS}123456${GS}${GS}${GS}001/002${GS}01.50KG${GS}N${GS}24 RUE DE L UNIVERSITE${GS}PARIS${GS}${GS}${recipient}${GS}${RS}${EOT}`;

const fedexPdf417 = (tracking: string) =>
  `[)>${RS}01${GS}0275007${GS}250${GS}020${GS}${tracking}${GS}FDE${GS}123456789${GS}042${GS}${GS}1/1${GS}0.50KG${GS}N${GS}24 RUE DE L UNIVERSITE${GS}PARIS${GS}IDF${GS}PAUL LANGEVIN${RS}06${GS}10ZGD003${GS}11ZACME SRL${GS}12Z+33612345678${RS}${EOT}`;

const DPD = '01234567890128';
const UPS = '1Z12345E0205271686';
const FEDEX = '794644790131';

describe('confidence', () => {
  it('combines independent sources and caps at 0.99', () => {
    expect(combine([0.97, 0.95])).toBe(0.99);
    expect(combine([0.85, 0.85])).toBeCloseTo(0.9775, 4);
    expect(combine([0.4])).toBe(0.4);
  });

  it('maps confidences to the display levels of §4.4', () => {
    expect(levelOf(0.9)).toBe('sure');
    expect(levelOf(0.89)).toBe('to-verify');
    expect(levelOf(0.6)).toBe('to-verify');
    expect(levelOf(0.59)).toBe('none');
  });
});

describe('extractFields — tracking', () => {
  it('reads a sure 1D tracking at 0.95', () => {
    const { tracking, carrier } = extractFields({
      symbols: [{ format: 'Code128', text: UPS }],
    });
    expect(tracking).toMatchObject({
      value: UPS,
      confidence: CONFIDENCE.keyed1d,
      level: 'sure',
      flags: [],
    });
    expect(tracking?.sources).toEqual([
      { kind: '1d', format: 'Code128', confidence: 0.95, value: UPS },
    ]);
    expect(carrier).toMatchObject({ value: 'ups', level: 'sure' });
  });

  it('keeps a format-only 1D tracking at 0.85, to verify', () => {
    const { tracking, carrier } = extractFields({
      symbols: [{ format: 'Code128', text: DPD }],
    });
    expect(tracking).toMatchObject({
      value: DPD,
      confidence: CONFIDENCE.format1d,
      level: 'to-verify',
    });
    expect(carrier).toBeNull();
  });

  it('drops a rejected 1D number and reads nothing', () => {
    const { tracking, carrier } = extractFields({
      symbols: [{ format: 'Code128', text: '1Z12345E0205271687' }],
    });
    expect(tracking).toBeNull();
    expect(carrier).toBeNull();
  });

  it('takes a structured 2D tracking at 0.97', () => {
    const { tracking, carrier, recipient, pieces, weightKg } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec(DPD) }],
    });
    expect(tracking).toMatchObject({ value: DPD, confidence: 0.97 });
    expect(carrier).toMatchObject({ value: 'dpd', confidence: 0.97 });
    expect(recipient).toMatchObject({ value: 'MARIE CURIE', level: 'sure' });
    expect(pieces).toMatchObject({ value: { index: 1, total: 2 } });
    expect(weightKg).toMatchObject({ value: 1.5 });
  });

  it('does not trust a structured field whose number has no known shape', () => {
    const { tracking, carrier } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec('HA123456789012', 'X', 'CHRO') },
      ],
    });
    expect(tracking).toMatchObject({
      value: 'HA123456789012',
      confidence: CONFIDENCE.format1d,
      level: 'to-verify',
    });
    expect(carrier).toMatchObject({ value: 'chronopost', level: 'sure' });
  });

  it('keeps the other fields of a code whose tracking fails its key', () => {
    const maxicode = `[)>${RS}01${GS}9675007${GS}250${GS}011${GS}1ZE0205271${GS}UPSN${GS}12345E${GS}042${GS}${GS}1/2${GS}3${GS}N${GS}${GS}PARIS${GS}${RS}${EOT}`;
    const { tracking, carrier, pieces, weightKg } = extractFields({
      symbols: [{ format: 'MaxiCode', text: maxicode }],
    });
    expect(tracking).toBeNull();
    expect(carrier).toMatchObject({ value: 'ups', level: 'sure' });
    expect(pieces).toMatchObject({ value: { index: 1, total: 2 } });
    expect(weightKg?.value).toBeCloseTo(1.36, 2);
  });

  it('raises an agreeing 2D and 1D pair to the cap', () => {
    const { tracking, carrier } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'Code128', text: `%007500701234567890128101250` },
      ],
    });
    expect(tracking).toMatchObject({ value: DPD, confidence: 0.99, flags: [] });
    expect(tracking?.sources.map((s) => s.kind)).toEqual(['2d', '1d']);
    expect(carrier?.sources).toHaveLength(2);
  });

  it('keeps the best-ranked source with a malus when sources disagree', () => {
    const { tracking } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'Code128', text: UPS },
      ],
    });
    expect(tracking).toMatchObject({
      value: DPD,
      confidence: 0.82,
      level: 'to-verify',
      flags: ['conflict'],
    });
    expect(tracking?.candidates.map((c) => c.value)).toEqual([DPD, UPS]);
  });

  it('keeps a code of unknown shape as noise, not as a contradiction', () => {
    const { tracking } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'Code128', text: '%007500701234567890128101250X' },
      ],
    });
    expect(tracking).toMatchObject({ value: DPD, confidence: 0.97, flags: [] });
    expect(tracking?.candidates[1]).toMatchObject({
      confidence: CONFIDENCE.unvalidated,
    });
  });

  it('validates a 1D number in the context of the 2D carrier', () => {
    const { tracking } = extractFields({
      symbols: [
        { format: 'PDF417', text: fedexPdf417(FEDEX) },
        { format: 'Code128', text: FEDEX },
      ],
    });
    expect(tracking).toMatchObject({ value: FEDEX, confidence: 0.99 });
  });
});

describe('extractFields — carrier vote', () => {
  it('lets the 2D network outvote a 1D format', () => {
    const { carrier } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'Code128', text: UPS },
      ],
    });
    expect(carrier).toMatchObject({
      value: 'dpd',
      flags: ['conflict'],
      level: 'to-verify',
    });
    expect(carrier?.candidates.map((c) => c.value)).toEqual(['dpd', 'ups']);
  });

  it('cannot be sure on a tie', () => {
    const { carrier } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'PDF417', text: fedexPdf417(FEDEX) },
      ],
    });
    expect(carrier?.flags).toEqual(['conflict', 'tie']);
    expect(carrier?.level).toBe('to-verify');
  });

  it('names the carrier of a shape shared by several carriers to verify', () => {
    const { tracking, carrier } = extractFields({
      symbols: [{ format: 'Code128', text: FEDEX }],
    });
    expect(tracking).toMatchObject({ value: FEDEX, level: 'sure' });
    expect(carrier).toMatchObject({
      value: 'fedex',
      confidence: CONFIDENCE.format1d,
      level: 'to-verify',
    });
  });
});

describe('extractFields — parties', () => {
  it('groups the same name written differently', () => {
    const { recipient } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD, 'Marie CURIE') },
        { format: 'Aztec', text: dpdAztec(DPD, 'MARIE  CURIE') },
      ],
    });
    expect(recipient).toMatchObject({ confidence: 0.99, flags: [] });
  });

  it('reads the FedEx sender and ranks a second recipient', () => {
    const { sender, recipient } = extractFields({
      symbols: [
        { format: 'PDF417', text: fedexPdf417(FEDEX) },
        { format: 'Aztec', text: dpdAztec(DPD) },
      ],
    });
    expect(sender).toMatchObject({ value: 'ACME SRL', level: 'sure' });
    expect(recipient?.candidates).toHaveLength(2);
    expect(recipient?.flags).toEqual(['conflict']);
  });
});

describe('extractFields — inputs', () => {
  it('returns empty fields without symbols', () => {
    expect(extractFields({ symbols: [] })).toEqual({
      tracking: null,
      carrier: null,
      recipient: null,
      sender: null,
      pieces: null,
      weightKg: null,
      codes: [],
    });
  });

  it('accepts an OCR input and ignores it for now', () => {
    const { tracking } = extractFields({
      symbols: [{ format: 'Code128', text: UPS }],
      ocr: { text: `TRACKING ${FEDEX}` },
    });
    expect(tracking).toMatchObject({
      value: UPS,
      candidates: [{ value: UPS }],
    });
  });
});
