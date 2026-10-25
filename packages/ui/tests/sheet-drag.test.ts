import { describe, expect, it } from 'vitest';
import { releasesSheet, releaseVelocity } from '#components/sheet/drag';

describe('releasesSheet', () => {
  it('settles back after a short pull, slow', () => {
    expect(releasesSheet(20, 0.1, 560)).toBe(false);
    expect(releasesSheet(100, 0.2, 560)).toBe(false);
  });

  it('closes once pulled far enough, whatever the speed', () => {
    expect(releasesSheet(120, 0, 560)).toBe(true);
    expect(releasesSheet(90, 0, 240)).toBe(true);
  });

  it('closes on a flick down, but not on a trembling tap', () => {
    expect(releasesSheet(40, 0.8, 560)).toBe(true);
    expect(releasesSheet(12, 2, 560)).toBe(false);
    expect(releasesSheet(60, -0.8, 560)).toBe(false);
  });
});

describe('releaseVelocity', () => {
  it('forgets the speed of a finger that rested before letting go', () => {
    expect(releaseVelocity(1.2, 1000, 1050)).toBe(1.2);
    expect(releaseVelocity(1.2, 1000, 1300)).toBe(0);
  });
});
