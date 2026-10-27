import { describe, expect, it } from 'vitest';
import { extractFields } from '@repo/contract/extract';
import type { Label } from '@repo/corpus/schema';
import { measure, sameName } from '#measure';

const label = (over: Partial<Label> = {}): Label => ({
  id: 'test',
  source: 'real',
  file: 'test.jpg',
  carrier: 'ups',
  tracking: '1Z 12345E 02 0527 1686',
  recipient: 'Dupont Jean',
  sender: null,
  pieces: null,
  weightKg: null,
  difficulties: [],
  reviewed: true,
  ...over,
});

const byField = (outcomes: ReturnType<typeof measure>, field: string) =>
  outcomes.find((o) => o.field === field)!;

describe('sameName', () => {
  it('ignores order, case, accents and punctuation', () => {
    expect(sameName('Dupont Jean', 'JEAN DUPONT')).toBe(true);
    expect(sameName('Hélène Lefèvre-Martin', 'HELENE LEFEVRE MARTIN')).toBe(
      true,
    );
  });

  it('accepts a name contained in a longer one, not another name', () => {
    expect(sameName('Marie Curie', 'MME MARIE CURIE')).toBe(true);
    expect(sameName('Marie Curie', 'PIERRE CURIE')).toBe(false);
    expect(sameName('Marie Curie', 'MARIE CURIEUX')).toBe(false);
    expect(sameName('Jean', 'JEANNE DUPONT')).toBe(false);
    expect(sameName('Ltd', 'ACME LTD')).toBe(false);
    expect(sameName('Acme', 'ACME')).toBe(true);
    expect(sameName('', 'PIERRE CURIE')).toBe(false);
  });
});

describe('measure', () => {
  it('counts a sure tracking equal to the printed annotation as sure-ok', () => {
    const outcomes = measure(
      label(),
      extractFields({
        symbols: [{ format: 'Code128', text: '1Z12345E0205271686' }],
      }),
    );
    expect(byField(outcomes, 'tracking')).toMatchObject({
      status: 'sure-ok',
      expected: '1Z 12345E 02 0527 1686',
      proposed: '1Z12345E0205271686',
      confidence: 0.95,
      inTop3: true,
      sources: ['1d:Code128'],
    });
    expect(byField(outcomes, 'carrier').status).toBe('sure-ok');
  });

  it('flags a sure but different number as sure-wrong', () => {
    const outcomes = measure(
      label({ tracking: '1Z999AA10123456784' }),
      extractFields({
        symbols: [{ format: 'Code128', text: '1Z12345E0205271686' }],
      }),
    );
    expect(byField(outcomes, 'tracking')).toMatchObject({
      status: 'sure-wrong',
      inTop3: false,
    });
  });

  it('takes another valid number the label prints as right', () => {
    const outcomes = measure(
      label({
        tracking: '1Z999AA10123456784',
        otherTrackings: ['1Z12345E0205271686'],
      }),
      extractFields({
        symbols: [{ format: 'Code128', text: '1Z12345E0205271686' }],
      }),
    );
    expect(byField(outcomes, 'tracking')).toMatchObject({
      status: 'sure-ok',
      expected: '1Z12345E0205271686',
    });
  });

  it('reads an SSCC with its application identifier as the same number', () => {
    const outcomes = measure(
      label({ carrier: 'dhl-paket', tracking: '340433929710469734' }),
      extractFields({
        symbols: [{ format: 'Code128', text: '(00)340433929710469734' }],
      }),
    );
    expect(byField(outcomes, 'tracking').status).toMatch(/-ok$/);
  });

  it('leaves un-annotated fields out and reports empty ones', () => {
    const outcomes = measure(label(), extractFields({ symbols: [] }));
    expect(byField(outcomes, 'tracking').status).toBe('empty');
    expect(byField(outcomes, 'recipient').status).toBe('empty');
    expect(byField(outcomes, 'sender').status).toBe('not-annotated');
    expect(byField(outcomes, 'weightKg').status).toBe('not-annotated');
  });

  it('tolerates the whole pounds of a MaxiCode on the weight', () => {
    const extraction = extractFields({ symbols: [] });
    const weight = {
      ...extraction,
      weightKg: {
        value: 4.54,
        confidence: 0.97,
        level: 'sure' as const,
        sources: [],
        flags: [],
        candidates: [],
      },
    };
    const status = (kg: number) =>
      byField(measure(label({ weightKg: kg }), weight), 'weightKg').status;
    expect(status(4.7)).toBe('sure-ok');
    expect(status(5.2)).toBe('sure-wrong');
  });

  it('shows pieces and weight the same way on both sides', () => {
    const outcomes = measure(
      label({ pieces: { index: 1, total: 2 }, weightKg: 1.5 }),
      extractFields({ symbols: [] }),
    );
    expect(byField(outcomes, 'pieces').expected).toBe('1/2');
    expect(byField(outcomes, 'weightKg').expected).toBe('1.50');
  });
});
