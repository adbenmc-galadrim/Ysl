import { describe, expect, it } from 'vitest';
import { EOT, GS, RS } from '@repo/contract/codes';
import { CONFIDENCE, extractFields, observeOcr } from '@repo/contract/extract';

const UPS = '1Z12345E0205271686';

const maxicode = (pieces: string, weight = '3') =>
  `[)>${RS}01${GS}9675007${GS}250${GS}002${GS}1Z0205271686${GS}UPSN${GS}12345E${GS}042${GS}${GS}${pieces}${GS}${weight}${GS}N${GS}${GS}PARIS${GS}${RS}${EOT}`;

const ocr = (text: string) => extractFields({ symbols: [], ocr: { text } });

describe('observeOcr — pieces', () => {
  it('reads the worded forms at 0.65', () => {
    expect(ocr('PKG 1 OF 3').pieces).toMatchObject({
      value: { index: 1, total: 3 },
      confidence: CONFIDENCE.ocrFormat,
      level: 'to-verify',
      sources: [{ kind: 'ocr', format: 'text', value: '1/3' }],
    });
    expect(ocr('Colis 2 sur 3').pieces?.value).toEqual({ index: 2, total: 3 });
    expect(ocr('PIÈCE 1/3').pieces?.value).toEqual({ index: 1, total: 3 });
    expect(ocr('1 OF 2').pieces?.value).toEqual({ index: 1, total: 2 });
  });

  it('reads a bare n/N at 0.40 only', () => {
    expect(ocr('WT 1.2 KG 1/3').pieces).toMatchObject({
      value: { index: 1, total: 3 },
      confidence: CONFIDENCE.unvalidated,
      level: 'none',
    });
  });

  it('ignores dates, fractions of more and n > N', () => {
    expect(ocr('12/10/2026').pieces).toBeNull();
    expect(ocr('10/2026').pieces).toBeNull();
    expect(ocr('DATE 24/10').pieces).toBeNull();
    expect(ocr('3/2').pieces).toBeNull();
    expect(ocr('PKG 3 OF 2').pieces).toBeNull();
    expect(ocr('PAGE 1 OF 2').pieces).toBeNull();
  });
});

describe('observeOcr — weight', () => {
  it('reads kilograms and converts pounds', () => {
    expect(ocr('WT 1.2 KG').weightKg).toMatchObject({
      value: 1.2,
      confidence: CONFIDENCE.ocrFormat,
      sources: [{ value: '1.2 KG' }],
    });
    expect(ocr('POIDS 1,25 KGS').weightKg?.value).toBe(1.25);
    expect(ocr('2.5 LBS').weightKg?.value).toBeCloseTo(1.134, 3);
  });

  it('drops an implausible weight', () => {
    expect(ocr('0.0 KG').weightKg).toBeNull();
    expect(ocr('120 KG').weightKg).toBeNull();
    expect(ocr('WT KG').weightKg).toBeNull();
  });

  it('takes the kilograms and the pounds of one label as one weight', () => {
    const { weightKg } = ocr('WT 1.2 KG (2.6 LBS)');
    expect(weightKg).toMatchObject({ value: 1.2, flags: [] });
    expect(weightKg?.candidates).toHaveLength(1);
  });
});

describe('observeOcr — service and reference', () => {
  it('names the printed service', () => {
    expect(ocr('UPS NEXT DAY AIR SAVER').service).toMatchObject({
      value: { code: null, label: 'Next Day Air Saver' },
      confidence: CONFIDENCE.ocrFormat,
    });
    expect(ocr('FEDEX EXPRESS SAVER').service?.value.label).toBe(
      'Express Saver',
    );
    expect(ocr('LETTRE RECOMMANDÉE AVEC AR').service?.value.label).toBe(
      'Recommandé',
    );
    expect(ocr('EXPRESS 12:00').service?.value.label).toBe('Express 12:00');
  });

  it('tells the UPS saver from the FedEx one, and a floor from the ground', () => {
    expect(ocr('UPS EXPRESS SAVER').service?.value.label).toBe(
      'Worldwide Saver',
    );
    expect(ocr('GROUND FLOOR, 12 RUE DES LILAS').service).toBeNull();
  });

  it('agrees the MaxiCode class with the 1Z of a code the carrier does not name', () => {
    const { service } = extractFields({
      symbols: [
        { format: 'MaxiCode', text: maxicode('1/1').replace('002', '004') },
        { format: 'Code128', text: '1ZE6344W0499230622' },
      ],
    });
    expect(service).toMatchObject({
      value: { code: '04', label: null },
      flags: [],
      sources: [{ kind: '2d' }, { kind: '1d' }],
    });
  });

  it('reads the service name the carrier of the codes gives it', () => {
    const upsMaxicode = maxicode('1/1').replace('002', '065');
    const { service } = extractFields({
      symbols: [{ format: 'MaxiCode', text: upsMaxicode }],
      ocr: { text: 'EXPRESS SAVER' },
    });
    expect(service).toMatchObject({
      value: { code: '65', label: 'Worldwide Saver' },
      confidence: 0.99,
      flags: [],
    });
    const fedex = extractFields({
      symbols: [{ format: 'Code128', text: '794644790131' }],
      ocr: { text: 'NEXT DAY AIR' },
    });
    expect(fedex.service).toBeNull();
  });

  it('reads one service per label', () => {
    expect(ocr('FEDEX GROUND HOME DELIVERY').service?.candidates).toHaveLength(
      1,
    );
    expect(ocr('TRACKING 1Z').service).toBeNull();
  });

  it('reads what follows REF at 0.40', () => {
    expect(ocr('REF: PO-4471/B').reference).toMatchObject({
      value: 'PO-4471/B',
      confidence: CONFIDENCE.unvalidated,
      level: 'none',
    });
    expect(ocr('Référence n° ABC123').reference?.value).toBe('ABC123');
    expect(ocr('REFRIGERATEUR').reference).toBeNull();
  });

  it('keeps the observations of one text apart', () => {
    const read = observeOcr('PKG 1 OF 3  WT 1.2 KG  REF ABC123  GROUND');
    expect(read.pieces).toHaveLength(1);
    expect(read.weights).toHaveLength(1);
    expect(read.services[0]?.value.label).toBe('Ground');
    expect(read.references[0]?.value).toBe('ABC123');
  });
});

describe('extractFields — codes and OCR together', () => {
  it('raises a 2D field the OCR confirms', () => {
    const { pieces, weightKg } = extractFields({
      symbols: [{ format: 'MaxiCode', text: maxicode('1/3') }],
      ocr: { text: 'PKG 1 OF 3  WT 3.0 KG' },
    });
    expect(pieces).toMatchObject({
      value: { index: 1, total: 3 },
      confidence: 0.99,
      flags: [],
    });
    expect(pieces?.sources.map((s) => s.kind)).toEqual(['2d', 'ocr']);
    expect(weightKg).toMatchObject({ confidence: 0.99, flags: [] });
  });

  it('keeps the 2D field with a malus when the OCR contradicts it', () => {
    const { pieces } = extractFields({
      symbols: [{ format: 'MaxiCode', text: maxicode('1/3') }],
      ocr: { text: 'PKG 1 OF 2' },
    });
    expect(pieces).toMatchObject({
      value: { index: 1, total: 3 },
      confidence: 0.82,
      level: 'to-verify',
      flags: ['conflict'],
    });
    expect(pieces?.candidates).toHaveLength(2);
  });

  it('does not count a bare n/N against a 2D code', () => {
    const { pieces } = extractFields({
      symbols: [{ format: 'MaxiCode', text: maxicode('1/3') }],
      ocr: { text: '1/2' },
    });
    expect(pieces).toMatchObject({ value: { index: 1, total: 3 }, flags: [] });
  });

  it('confirms the service of the 1Z with the printed name', () => {
    const { service } = extractFields({
      symbols: [{ format: 'Code128', text: UPS }],
      ocr: { text: 'UPS 2ND DAY AIR' },
    });
    expect(service).toMatchObject({
      value: { code: '02', label: '2nd Day Air' },
      confidence: 0.976,
      flags: [],
    });
  });

  it('leaves the tracking to the codes', () => {
    const { tracking } = extractFields({
      symbols: [{ format: 'Code128', text: UPS }],
      ocr: { text: 'TRACKING 794644790131' },
    });
    expect(tracking).toMatchObject({
      value: UPS,
      candidates: [{ value: UPS }],
    });
  });
});
