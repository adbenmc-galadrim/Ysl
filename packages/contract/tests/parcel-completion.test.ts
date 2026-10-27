import { describe, expect, it } from 'vitest';
import {
  internalTracking,
  isInternalTracking,
  isParcelComplete,
  parcelGaps,
} from '../src/parcel-completion';
import { normalizeTracking, validateTracking } from '../src/tracking';

const parcel = {
  type: 'colis' as const,
  carrier: 'UPS',
  tracking: '1Z999AA10123456784',
  recipient: true,
};

describe('parcelGaps', () => {
  it('needs both the recipient and the number with its carrier', () => {
    expect(parcelGaps(parcel)).toEqual([]);
    expect(isParcelComplete(parcel)).toBe(true);
    expect(parcelGaps({ ...parcel, recipient: false })).toEqual(['recipient']);
    expect(parcelGaps({ ...parcel, carrier: null })).toEqual(['carrier']);
    expect(parcelGaps({ ...parcel, tracking: ' ', carrier: null })).toEqual([
      'tracking',
    ]);
    expect(parcelGaps({ ...parcel, tracking: null, recipient: false })).toEqual(
      ['recipient', 'tracking'],
    );
  });

  it('asks no number of a parcel « Sans suivi »', () => {
    const untracked = { ...parcel, type: 'sans_suivi' as const, carrier: null };
    expect(parcelGaps(untracked)).toEqual([]);
    expect(parcelGaps({ ...untracked, recipient: false })).toEqual([
      'recipient',
    ]);
  });
});

describe('internalTracking', () => {
  it('draws a valid id that normalisation keeps and no carrier claims', () => {
    const id = internalTracking();
    expect(isInternalTracking(id)).toBe(true);
    expect(normalizeTracking(id)).toBe(id);
    expect(validateTracking(id).carrier).toBeNull();
  });

  it('spells the drawn bits in Crockford base 32', () => {
    expect(internalTracking((count) => new Uint8Array(count))).toBe(
      'INT00000000',
    );
    expect(internalTracking((count) => new Uint8Array(count).fill(255))).toBe(
      'INTZZZZZZZZ',
    );
  });

  it('draws a different id each time', () => {
    const ids = new Set(Array.from({ length: 200 }, () => internalTracking()));
    expect(ids.size).toBe(200);
  });

  it('refuses what it would not draw', () => {
    expect(isInternalTracking('INT-0000000')).toBe(false);
    expect(isInternalTracking('INTOOOOOOOO')).toBe(false);
    expect(isInternalTracking('1Z999AA10123456784')).toBe(false);
    expect(isInternalTracking(null)).toBe(false);
  });
});
