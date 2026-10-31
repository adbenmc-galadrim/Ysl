import { describe, expect, it } from 'vitest';
import { EOT, GS, RS } from '@repo/contract/codes';
import {
  CONFIDENCE,
  explainField,
  extractFields,
  extractRecipient,
  sourceRank,
} from '@repo/contract/extract';

const UPS = '1Z12345E0205271686';
const DHL = '5413337112';
const DPD = '01234567890128';

const dpdAztec = (recipient: string, postal = '75007') =>
  `[)>${RS}01${GS}02${GS}${postal}${GS}250${GS}328${GS}${DPD}${GS}GEOP${GS}123456${GS}${GS}${GS}001/001${GS}01.50KG${GS}N${GS}24 RUE DE L UNIVERSITE${GS}PARIS${GS}${GS}${recipient}${GS}${RS}${EOT}`;

describe('sourceRank — the rank of §4.3', () => {
  it.each([
    [{ kind: '2d', confidence: CONFIDENCE.structured2d }, 1],
    [{ kind: '1d', confidence: CONFIDENCE.keyed1d }, 2],
    [{ kind: '1d', confidence: CONFIDENCE.derived }, 3],
    [{ kind: '1d', confidence: CONFIDENCE.format1d }, 4],
    [{ kind: 'ocr', confidence: CONFIDENCE.ocrKeyed }, 5],
    [{ kind: 'ocr', confidence: CONFIDENCE.ocrFormat }, 6],
    [{ kind: 'ocr', confidence: CONFIDENCE.unvalidated }, 7],
    [{ kind: '1d', confidence: CONFIDENCE.unvalidated }, 7],
    [{ kind: 'learned', confidence: CONFIDENCE.knownSender }, 8],
    [{ kind: 'agent', confidence: 1 }, 9],
    [{ kind: '2d', confidence: 0.5 }, null],
  ] as const)('%o is rank %s', (source, rank) => {
    expect(sourceRank({ ...source, format: 'x', value: 'x' })).toBe(rank);
  });
});

describe('explainField — from the best source to the confidence shown', () => {
  it('replays two sources that agree, capped at 0,99', () => {
    const { tracking } = extractFields({
      symbols: [
        { format: 'Code128', text: UPS },
        { format: 'Code39', text: UPS },
      ],
    });
    expect(explainField(tracking!)).toEqual({
      base: CONFIDENCE.keyed1d,
      adjustments: [{ kind: 'agreement', delta: 0.04 }],
      confidence: CONFIDENCE.cap,
    });
  });

  it('replays the malus of a contradiction', () => {
    const recipient = extractRecipient([
      {
        name: 'CAMILLE MOREL',
        source: {
          kind: '2d',
          format: 'Aztec',
          confidence: CONFIDENCE.structured2d,
          value: 'CAMILLE MOREL',
        },
      },
      {
        name: 'JEAN DUPUIS',
        source: {
          kind: 'ocr',
          format: 'block',
          confidence: CONFIDENCE.ocrFormat,
          value: 'JEAN DUPUIS',
        },
      },
    ]);
    const explained = explainField(recipient!);
    expect(explained.adjustments).toEqual([
      { kind: 'conflict', delta: -CONFIDENCE.conflictMalus },
    ]);
    expect(explained.confidence).toBe(recipient!.confidence);
  });

  it('lists the O1 cap of a tracking without a key', () => {
    const { tracking } = extractFields({
      symbols: [{ format: 'Code128', text: DHL }],
    });
    const explained = explainField(tracking!);
    expect(explained.adjustments.map((a) => a.kind)).toEqual(['unkeyed']);
    expect(explained.confidence).toBeLessThanOrEqual(CONFIDENCE.unkeyedCap);
  });

  it('replays the malus of a recipient addressed elsewhere', () => {
    const { recipient } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec('CAMILLE MOREL', '69002') }],
      reception: { postalCode: '75007' },
    });
    expect(explainField(recipient!).adjustments).toEqual([
      { kind: 'forward', delta: -CONFIDENCE.forwardMalus },
    ]);
  });

  it('finds the directory bonus in what the flags do not explain', () => {
    const recipient = extractRecipient(
      [
        {
          name: 'CAMILLE MOREL',
          source: {
            kind: 'ocr',
            format: 'block',
            confidence: CONFIDENCE.ocrFormat,
            value: 'CAMILLE MOREL',
          },
        },
      ],
      ['Camille Morel'],
    );
    expect(explainField(recipient!).adjustments).toEqual([
      { kind: 'directory', delta: CONFIDENCE.directoryBonus },
    ]);
  });

  it('adds nothing to a single source taken as is', () => {
    expect(
      explainField({
        confidence: 1,
        flags: [],
        sources: [
          { kind: 'agent', format: 'agent', confidence: 1, value: 'x' },
        ],
      }),
    ).toEqual({ base: 1, adjustments: [], confidence: 1 });
  });
});
