import { describe, expect, it } from 'vitest';
import { readPieces } from '#components/piece-dots';
import { missingPiecesLabel } from '#screens/reception/scan-screen';

describe('readPieces', () => {
  it('counts from the first piece when given a number, keeps the numbers given otherwise', () => {
    expect([...readPieces(2, 3)]).toEqual([1, 2]);
    expect([...readPieces(5, 3)]).toEqual([1, 2, 3]);
    expect([...readPieces([1, 3], 3)]).toEqual([1, 3]);
    expect([...readPieces([0, 4, 2], 3)]).toEqual([2]);
  });
});

describe('missingPiecesLabel', () => {
  it('names the one piece missing by its number, not by counting', () => {
    expect(missingPiecesLabel({ total: 3, read: [1, 2] })).toBe(
      'La 3e pièce manque',
    );
    expect(missingPiecesLabel({ total: 3, read: [1, 3] })).toBe(
      'La 2e pièce manque',
    );
  });

  it('counts the pieces missing when there are several, none when complete', () => {
    expect(missingPiecesLabel({ total: 3, read: [2] })).toBe(
      '2 pièces manquent',
    );
    expect(missingPiecesLabel({ total: 3, read: [1, 2, 3] })).toBeNull();
  });
});
