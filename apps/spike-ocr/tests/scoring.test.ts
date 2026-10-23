import { describe, expect, it } from 'vitest';
import { accuracyOf, scorePhoto } from '#/scoring/scoring';

const directory = ['Jade Mercier', 'Léa Dupuis', 'Hugo Roux'];

describe('accuracy', () => {
  it('leaves labels without recipient out of the recipient denominator', () => {
    const scores = [
      scorePhoto(
        { recipient: 'Jade Mercier', sender: 'ACME SAMPLES INC' },
        ['JADE MERCIER', 'ACME SAMPLES INC'],
        directory,
      ),
      scorePhoto(
        { recipient: null, sender: 'ACME SAMPLES INC' },
        ['ACME SAMPLES INC'],
        directory,
      ),
      scorePhoto(
        { recipient: 'Hugo Roux', sender: null },
        ['HUGO ROUX'],
        directory,
      ),
    ];

    const accuracy = accuracyOf(scores);

    expect(accuracy.recipient).toEqual({ correct: 2, total: 2, rate: 1 });
    expect(accuracy.sender).toEqual({ correct: 2, total: 2, rate: 1 });
  });

  it('has no rate when no label carries the field', () => {
    const accuracy = accuracyOf([
      scorePhoto({ recipient: null, sender: null }, ['TEXTE'], directory),
    ]);

    expect(accuracy.recipient).toEqual({
      correct: 0,
      total: 0,
      rate: undefined,
    });
    expect(accuracy.sender.rate).toBeUndefined();
  });

  it('counts a failed photo as wrong, not as skipped', () => {
    const accuracy = accuracyOf([
      scorePhoto(
        { recipient: 'Jade Mercier', sender: 'ACME' },
        undefined,
        directory,
      ),
      scorePhoto(
        { recipient: 'Léa Dupuis', sender: 'ACME' },
        ['LEA DUPUIS', 'ACME'],
        directory,
      ),
    ]);

    expect(accuracy.recipient).toEqual({ correct: 1, total: 2, rate: 0.5 });
    expect(accuracy.sender.rate).toBe(0.5);
  });

  it('is right on the top 3 only when the truth is among them', () => {
    const wrong = scorePhoto(
      { recipient: 'Hugo Roux', sender: null },
      ['LEA DUPUIS'],
      directory,
    );

    expect(wrong.recipient?.correct).toBe(false);
    expect(wrong.recipient?.top[0]?.name).toBe('Léa Dupuis');
  });
});
