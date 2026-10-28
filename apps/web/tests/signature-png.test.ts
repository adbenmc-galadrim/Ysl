import { describe, expect, it } from 'vitest';
import { strokesBox } from '#/features/handover/signature-png';

describe('strokesBox', () => {
  it('spans every point of the strokes, curves included, from the bottom-left origin', () => {
    expect(strokesBox(['M10,-20Q30,-60 40,-50L80,-5', 'M5,-30L6,-31'])).toEqual(
      { minX: 5, minY: -60, maxX: 80, maxY: -5 },
    );
  });

  it('has nothing to crop without a stroke', () => {
    expect(strokesBox([])).toBeNull();
  });
});
