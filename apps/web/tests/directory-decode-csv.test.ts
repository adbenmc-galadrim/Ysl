import { describe, expect, it } from 'vitest';
import { decodeCsv } from '#/features/directory/decode-csv';

const bytesOf = (...values: number[]) => new Uint8Array(values).buffer;

describe('decodeCsv', () => {
  it('reads the accents of a file saved by Excel on Windows', () => {
    expect(decodeCsv(bytesOf(0x50, 0x72, 0xe9, 0x6e, 0x6f, 0x6d))).toBe(
      'Prénom',
    );
  });

  it('reads UTF-8 as UTF-8', () => {
    expect(decodeCsv(new TextEncoder().encode('Prénom').buffer)).toBe('Prénom');
  });
});
