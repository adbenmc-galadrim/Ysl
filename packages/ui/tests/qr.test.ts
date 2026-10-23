import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { encodeQr, qrLogoArea } from '#lib/qr';

const URL = 'https://ysl.shinseo.fr';

function decode(matrix: string[]): string | undefined {
  const scale = 8;
  const quiet = 4;
  const side = (matrix.length + 2 * quiet) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  matrix.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell !== '#') return;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i =
            (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4;
          pixels.fill(0, i, i + 3);
        }
      }
    });
  });
  return jsQR(pixels, side, side)?.data;
}

function withoutLogoArea(matrix: string[]): string[] {
  const [from, to] = qrLogoArea(matrix.length);
  return matrix.map((row, y) =>
    [...row]
      .map((cell, x) =>
        x >= from && x < to && y >= from && y < to ? '.' : cell,
      )
      .join(''),
  );
}

function errorCorrection(matrix: string[]): string {
  const cells: [number, number][] = [
    [0, 8],
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [7, 8],
    [8, 8],
    [8, 7],
    [8, 5],
    [8, 4],
    [8, 3],
    [8, 2],
    [8, 1],
    [8, 0],
  ];
  const bits = cells.reduce(
    (acc, [x, y]) => (acc << 1) | (matrix[y]![x] === '#' ? 1 : 0),
    0,
  );
  return ['M', 'L', 'H', 'Q'][((bits ^ 0b101010000010010) >> 13) & 0b11]!;
}

describe('encodeQr', () => {
  it('reads back the encoded URL', () => {
    expect(decode(encodeQr(URL))).toBe(URL);
  });

  it('declares error correction level H', () => {
    expect(errorCorrection(encodeQr(URL))).toBe('H');
  });

  it('still reads once the logo has cleared the centre', () => {
    expect(decode(withoutLogoArea(encodeQr(URL)))).toBe(URL);
  });
});
