import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  hasLabel,
  parcelOfRead,
  scanComplete,
} from '#/features/handover/parcel-scan';
import { parcelRow } from './helpers/local-rows';

const dpd = parcelRow({
  tracking: '09445566774471',
  trackingNorm: '09445566774471',
});
const ups = parcelRow({
  tracking: '1Z E634 4W04 9923 0622',
  trackingNorm: '1ZE6344W0499230622',
});
const courier = parcelRow({
  type: 'sans_suivi',
  tracking: 'INT1',
  trackingNorm: 'INT1',
});

describe('checking the parcels at the counter', () => {
  it('finds the parcel by its number, typed or read, whatever the spacing', () => {
    expect(parcelOfRead('09445566774471', [dpd, ups])).toBe(dpd);
    expect(parcelOfRead('1z e634 4w04 9923 0622', [dpd, ups])).toBe(ups);
  });

  it('finds the number inside a 2D code', () => {
    expect(parcelOfRead('[)>0196123451ZE6344W0499230622', [dpd, ups])).toBe(
      ups,
    );
  });

  it('does not take the label of another parcel', () => {
    expect(parcelOfRead('00000000000000', [dpd, ups])).toBeUndefined();
    expect(parcelOfRead('   ', [dpd, ups])).toBeUndefined();
  });

  it('a parcel « Sans suivi » has no label to scan and holds nothing back', () => {
    expect(hasLabel(courier)).toBe(false);
    expect(parcelOfRead('INT1', [courier])).toBeUndefined();
    expect(scanComplete([courier], new Set())).toBe(true);
  });

  it('every tracked parcel about to leave must be read', () => {
    expect(scanComplete([dpd, ups], new Set([dpd.id]))).toBe(false);
    expect(scanComplete([dpd, ups], new Set([dpd.id, ups.id]))).toBe(true);
    expect(scanComplete([dpd], new Set([dpd.id, ups.id]))).toBe(true);
  });
});
