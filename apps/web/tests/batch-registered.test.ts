import { describe, expect, it } from 'vitest';
import { parcelTypeOf } from '#/features/batch/store';

const read = (label: string) => ({
  annex: {
    pieces: null,
    weightKg: null,
    service: { code: null, label, level: 'sure' as const },
    reference: null,
  },
});

describe('parcelTypeOf', () => {
  it('stays a parcel with the option off, even on a registered label', () => {
    expect(parcelTypeOf(read('Recommandé'), false)).toBe('colis');
  });

  it('takes a label read as registered with the option on', () => {
    expect(parcelTypeOf(read('Recommandé'), true)).toBe('recommande');
    expect(parcelTypeOf(read('Express Saver'), true)).toBe('colis');
    expect(parcelTypeOf({ annex: null }, true)).toBe('colis');
  });

  it('follows what the agent chose over what the label says', () => {
    expect(
      parcelTypeOf({ annex: null, type: 'recommande' }, false),
    ).toBe('recommande');
    expect(
      parcelTypeOf({ ...read('Recommandé'), type: 'sans_suivi' }, true),
    ).toBe('sans_suivi');
  });
});
