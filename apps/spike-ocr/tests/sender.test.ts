import { describe, expect, it } from 'vitest';
import { senderFound } from '#/scoring/sender';

describe('senderFound', () => {
  it('accepts punctuation and case differences', () => {
    expect(
      senderFound('STAMPERIA ESEMPIO SRL', [
        'EXPEDITEUR',
        'Stamperia Esempio S.R.L.',
        'VIA DEI TESSUTI 21',
      ]),
    ).toBe(true);
  });

  it('accepts accents dropped and spaces lost by the OCR', () => {
    expect(senderFound('ATELIER TISSAGE NORD', ['ATELIERTISSAGE NORD'])).toBe(
      true,
    );
    expect(senderFound('Café Müller GmbH', ['CAFE MULLER GMBH'])).toBe(true);
  });

  it('tolerates a few misread characters, not many', () => {
    expect(
      senderFound('STAMPERIA ESEMPIO SRL', ['STAMPERIA ESEMPI0 SRL']),
    ).toBe(true);
    expect(
      senderFound('STAMPERIA ESEMPIO SRL', ['STAMPERIA XXXXXXX SRL']),
    ).toBe(false);
  });

  it('refuses another sender', () => {
    expect(
      senderFound('STAMPERIA ESEMPIO SRL', [
        'PRINT & PAPER LTD',
        'MUSTER VERSAND GMBH',
      ]),
    ).toBe(false);
  });

  it('refuses an empty OCR', () => {
    expect(senderFound('STAMPERIA ESEMPIO SRL', [])).toBe(false);
  });
});
