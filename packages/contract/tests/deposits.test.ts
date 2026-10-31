import { describe, expect, it } from 'vitest';
import {
  gapOfReceived,
  parcelsToSettle,
  readDepartmentQr,
  departmentQrText,
} from '../src/deposits';

describe('deposit rules', () => {
  it('reads back only a poster of ours', () => {
    const id = '01a19000-0000-7000-8000-000000000001';
    expect(readDepartmentQr(departmentQrText(id))).toBe(id);
    expect(readDepartmentQr('https://example.test')).toBeNull();
    expect(readDepartmentQr('courrier:depot:nope')).toBeNull();
  });

  it('makes a gap of what did not arrive, parcel by parcel', () => {
    expect(gapOfReceived(['a', 'b'], ['a'], null)).toEqual({
      kind: 'missing',
      parcelIds: ['b'],
    });
    expect(gapOfReceived(['a'], ['a'], null)).toBeNull();
  });

  it('blocks none for an extra, all when nobody can say', () => {
    expect(parcelsToSettle(['a'], { kind: 'extra', parcelIds: null })).toEqual(
      [],
    );
    expect(
      parcelsToSettle(['a', 'b'], { kind: 'missing', parcelIds: null }),
    ).toEqual(['a', 'b']);
  });
});
