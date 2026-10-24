import { describe, expect, it } from 'vitest';
import { fitWithin } from '#/features/camera/capture';

describe('fitWithin', () => {
  it('shrinks the long side to the limit and keeps the ratio', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never enlarges a small picture', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
