import { describe, expect, it } from 'vitest';
import { readOrientation } from '#/camera/exif';

type Order = 'II' | 'MM';

function tiff(order: Order, orientation: number, tagsBefore = 0): number[] {
  const little = order === 'II';
  const u16 = (value: number) =>
    little ? [value & 0xff, value >> 8] : [value >> 8, value & 0xff];
  const u32 = (value: number) =>
    little
      ? [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >> 24]
      : [value >> 24, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  const entry = (tag: number, value: number) => [
    ...u16(tag),
    ...u16(3),
    ...u32(1),
    ...u16(value),
    0,
    0,
  ];
  const others = Array.from({ length: tagsBefore }, (_, index) =>
    entry(0x0100 + index, 640),
  ).flat();
  return [
    ...[...order].map((char) => char.charCodeAt(0)),
    ...u16(42),
    ...u32(8),
    ...u16(tagsBefore + 1),
    ...others,
    ...entry(0x0112, orientation),
    ...u32(0),
  ];
}

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

const EXIF = [0x45, 0x78, 0x69, 0x66, 0, 0];

function jpeg(...segments: number[][]): ArrayBuffer {
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xd9]).buffer;
}

describe('readOrientation', () => {
  it.each([1, 3, 6, 8])('reads orientation %i, little-endian', (value) => {
    expect(
      readOrientation(jpeg(segment(0xe1, [...EXIF, ...tiff('II', value)]))),
    ).toBe(value);
  });

  it('reads a big-endian TIFF block behind other tags', () => {
    expect(
      readOrientation(jpeg(segment(0xe1, [...EXIF, ...tiff('MM', 6, 3)]))),
    ).toBe(6);
  });

  it('skips the segments before the EXIF block', () => {
    const app0 = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]);
    const xmp = segment(
      0xe1,
      [...'http://ns.adobe.com/xap/1.0/'].map((c) => c.charCodeAt(0)),
    );
    expect(
      readOrientation(
        jpeg(app0, xmp, segment(0xe1, [...EXIF, ...tiff('II', 8)])),
      ),
    ).toBe(8);
  });

  it('returns undefined without EXIF, for a non-JPEG or an out-of-range value', () => {
    expect(readOrientation(jpeg(segment(0xe0, [0, 0])))).toBeUndefined();
    expect(
      readOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer),
    ).toBeUndefined();
    expect(
      readOrientation(jpeg(segment(0xe1, [...EXIF, ...tiff('II', 9)]))),
    ).toBeUndefined();
  });

  it('stops on a truncated block instead of reading past it', () => {
    const full = new Uint8Array(
      jpeg(segment(0xe1, [...EXIF, ...tiff('II', 6, 4)])),
    );
    expect(readOrientation(full.slice(0, 30).buffer)).toBeUndefined();
  });
});
