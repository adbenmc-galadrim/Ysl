import { describe, expect, it } from 'vitest';
import { EMPTY_PICKUP, parsePickup } from '@repo/contract/settings';

describe('parsePickup', () => {
  it('reads nothing filled in from a missing or malformed value', () => {
    expect(parsePickup(undefined)).toEqual(EMPTY_PICKUP);
    expect(parsePickup({ place: 'Accueil' })).toEqual(EMPTY_PICKUP);
  });

  it('reads back a stored value as it was written', () => {
    const value = {
      ...EMPTY_PICKUP,
      place: 'Accueil',
      hours: { ...EMPTY_PICKUP.hours, mon: '9:00–12:00' },
    };
    expect(parsePickup(value)).toEqual(value);
  });
});
