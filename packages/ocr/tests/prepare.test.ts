import { describe, expect, it } from 'vitest';
import { fitWithin, MAX_SIDE } from '#engines/prepare';

describe('fitWithin', () => {
  it('shrinks a 12 Mpx photo to the working size, keeping the ratio', () => {
    expect(fitWithin(4000, 3000, MAX_SIDE)).toEqual({
      width: 1600,
      height: 1200,
    });
    expect(fitWithin(3000, 4000, MAX_SIDE)).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it('leaves a photo already within the working size untouched', () => {
    expect(fitWithin(1200, 900, MAX_SIDE)).toEqual({
      width: 1200,
      height: 900,
    });
    expect(fitWithin(1600, 1600, MAX_SIDE)).toEqual({
      width: 1600,
      height: 1600,
    });
  });

  it('never returns an empty side', () => {
    expect(fitWithin(10000, 1, MAX_SIDE)).toEqual({ width: 1600, height: 1 });
  });
});
