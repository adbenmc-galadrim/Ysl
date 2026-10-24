import { describe, expect, it } from 'vitest';
import { linesOf, toLine } from '#engines/lines';

const word = (text: string, x: number, confidence = 0.9) => ({
  text,
  box: { x, y: 10, width: 40, height: 12 },
  confidence,
});

describe('toLine', () => {
  it('unites the words of a line: joined text, enclosing box, mean score', () => {
    expect(toLine([word('Camille', 100, 0.8), word('MOREL', 150, 1)])).toEqual({
      text: 'Camille MOREL',
      box: { x: 100, y: 10, width: 90, height: 12 },
      score: 0.9,
    });
  });

  it('drops blank words and whole blank lines', () => {
    expect(toLine([word('  ', 0), word('DPD', 50)])).toMatchObject({
      text: 'DPD',
      box: { x: 50, width: 40 },
    });
    expect(toLine([word(' ', 0)])).toBeUndefined();
    expect(linesOf([[word('A', 0)], [], [word('B', 0)]])).toHaveLength(2);
  });
});
