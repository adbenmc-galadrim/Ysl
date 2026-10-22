import { describe, expect, it } from 'vitest';
import { manifestSchema } from '#schema';
import { annotate, plan } from '#synthetic/plan';

describe('synthetic plan', () => {
  it('the same seed gives the same ground truth', () => {
    expect(plan(1, 3).map(annotate)).toEqual(plan(1, 3).map(annotate));
  });

  it('produces annotations the manifest accepts', () => {
    expect(manifestSchema.safeParse(plan(2, 12).map(annotate)).success).toBe(
      true,
    );
  });
});
