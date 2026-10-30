import { EOT, GS, RS } from '@repo/contract/codes';
import { describe, expect, it } from 'vitest';
import { annexOf, ocrText, serviceText } from '#/features/scan/annex';

const UPS = '1ZE6344W0499230622';

/** A UPS MaxiCode: the pieces given, 3 lb, service class 002 → « 02 », shipment SHP-1. */
const maxicode = (pieces: string, service = '002') =>
  `[)>${RS}01${GS}9675007${GS}250${GS}${service}${GS}1Z99230623${GS}UPSN${GS}E6344W${GS}296${GS}SHP-1${GS}${pieces}${GS}3${GS}N${GS}${GS}PARIS${RS}${EOT}`;

const line = (text: string) => ({
  text,
  box: { x: 0, y: 0, width: 10, height: 10 },
  score: 0.9,
});

describe('annexOf', () => {
  it('takes the annex fields of a structured code as sure', () => {
    const annex = annexOf(
      [{ format: 'MaxiCode', text: maxicode('2/3') }],
      null,
    );
    expect(annex).toEqual({
      pieces: { index: 2, total: 3, level: 'sure' },
      weightKg: { value: 3, level: 'sure' },
      service: { code: '02', label: '2nd Day Air', level: 'sure' },
      reference: { value: 'SHP-1', level: 'sure' },
    });
  });

  it('keeps what the printed text alone says, to verify', () => {
    const annex = annexOf(
      [{ format: 'Code128', text: '01234567890128' }],
      [line('PKG 1 OF 3'), line('WT 1.2 KG'), line('EXPRESS SAVER')],
    );
    expect(annex).toEqual({
      pieces: { index: 1, total: 3, level: 'to-verify' },
      weightKg: { value: 1.2, level: 'to-verify' },
      service: { code: null, label: 'Express Saver', level: 'to-verify' },
      reference: null,
    });
  });

  it('drops a field read below « à vérifier »', () => {
    const annex = annexOf([], [line('1/3'), line('REF ABC123')]);
    expect(annex).toEqual({
      pieces: null,
      weightKg: null,
      service: null,
      reference: null,
    });
  });

  it('reads the service inside a bare 1Z', () => {
    const annex = annexOf([{ format: 'Code128', text: UPS }], null);
    expect(annex.service).toEqual({
      code: '04',
      label: null,
      level: 'sure',
    });
    expect(serviceText(annex)).toBe('04');
    expect(serviceText(annexOf([], null))).toBeNull();
  });

  it('joins the lines for the text rules', () => {
    expect(ocrText([line('A'), line('B')])).toBe('A\nB');
  });
});
