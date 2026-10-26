import { describe, expect, it } from 'vitest';
import { benchRecipients, syntheticDirectory } from '#recipients';

describe('benchRecipients', () => {
  it('builds the same directory on every run, without twins', () => {
    const people = syntheticDirectory(300);
    expect(people).toEqual(syntheticDirectory(300));
    const names = new Set(people.map((p) => `${p.firstName} ${p.lastName}`));
    expect(names.size).toBe(300);
  });

  it('never settles another person in silence, and proposes the right one', () => {
    const { outcomes, emptyReadName } = benchRecipients([100], 60);
    const total = outcomes.reduce(
      (acc, o) => ({
        cases: acc.cases + o.cases,
        top3: acc.top3 + o.top3,
        silent: acc.silent + o.wrongSilent,
      }),
      { cases: 0, top3: 0, silent: 0 },
    );
    expect(total.silent).toBe(0);
    expect(total.top3 / total.cases).toBeGreaterThanOrEqual(0.95);
    expect(emptyReadName).toBe(1);
  });
});
