import { describe, expect, it } from 'vitest';
import { extractionOf } from '#/features/batch/extraction';
import { DRAFT_AT, draftOf, line } from './helpers/drafts';

const DHL = '5413337112';

const ticks = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? values.at(-1)!;
};

describe('extractionOf — what the diagnostic reads back', () => {
  it('keeps the values the reader weighed when the agent confirmed the number', () => {
    const row = extractionOf(
      draftOf({
        tracking: DHL,
        trackingNorm: DHL,
        symbols: [{ format: 'Code128', text: DHL }],
        trackingConfirmed: true,
      }),
      DRAFT_AT,
    );
    expect(row.fields.tracking).toMatchObject({
      value: DHL,
      level: 'sure',
      sources: [{ kind: 'agent' }],
      candidates: [
        { value: DHL, sources: [{ kind: '1d', format: 'Code128' }] },
      ],
    });
  });

  it('keeps the printed text line by line and the name its block gave', () => {
    const row = extractionOf(
      draftOf({
        ocrName: 'JEAN DUPUIS',
        ocrLines: [line('SHIP TO'), line('JEAN DUPUIS')],
        symbols: [{ format: 'Code128', text: DHL }],
      }),
      DRAFT_AT,
    );
    expect(row.fields.recipient).toMatchObject({
      value: 'JEAN DUPUIS',
      sources: [{ kind: 'ocr', format: 'block' }],
    });
    expect(row.ocrText).toBe('SHIP TO\nJEAN DUPUIS');
  });

  it('writes how long scoring the fields took', () => {
    const row = extractionOf(
      draftOf({ durations: { codesMs: 120, ocrMs: 900 } }),
      DRAFT_AT,
      ticks(10, 13.4),
    );
    expect(row.durations).toEqual({ codesMs: 120, ocrMs: 900, fusionMs: 3 });
  });
});
