import { describe, expect, it } from 'vitest';
import { letterOf } from '#screens/reglages/annuaire-screen';

describe('letterOf', () => {
  it('files a name under its first letter, accent and case aside', () => {
    expect(letterOf('Élodie Roux')).toBe('E');
    expect(letterOf('axelle Bernard')).toBe('A');
    expect(letterOf('2e étage')).toBe('#');
  });
});
