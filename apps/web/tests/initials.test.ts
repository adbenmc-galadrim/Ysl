import { describe, expect, it } from 'vitest';
import { initialsOf } from '#/features/settings/initials';

describe('initialsOf', () => {
  it('takes the first and last names', () => {
    expect(initialsOf('Karim Daoud')).toBe('KD');
    expect(initialsOf('Anne-Lise de la Tour')).toBe('AT');
  });

  it('copes with a single word, and with none', () => {
    expect(initialsOf('agent')).toBe('AG');
    expect(initialsOf('  ')).toBe('');
  });

  it('keeps accents upper-cased', () => {
    expect(initialsOf('élodie martin')).toBe('ÉM');
  });
});
