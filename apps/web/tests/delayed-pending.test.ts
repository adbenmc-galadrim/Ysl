import { describe, expect, it } from 'vitest';
import { skeletonDue, SKELETON_DELAY_MS } from '#/lib/use-delayed-pending';

describe('skeletonDue', () => {
  it('shows nothing while the wait is shorter than the delay', () => {
    expect(skeletonDue(1_000, 1_000)).toBe(false);
    expect(skeletonDue(1_000, 1_000 + SKELETON_DELAY_MS - 1)).toBe(false);
  });

  it('shows the skeleton once the delay has passed', () => {
    expect(skeletonDue(1_000, 1_000 + SKELETON_DELAY_MS)).toBe(true);
  });

  it('shows nothing when no wait has started', () => {
    expect(skeletonDue(undefined, 5_000)).toBe(false);
  });
});
