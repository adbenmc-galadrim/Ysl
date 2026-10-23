import { describe, expect, it } from 'vitest';
import { isUuidV7, newId } from '#id';

describe('newId', () => {
  it('returns a UUID v7', () => {
    const id = newId();

    expect(isUuidV7(id)).toBe(true);
  });

  it('sorts in creation order, even within the same millisecond', () => {
    const ids = Array.from({ length: 1000 }, () => newId());

    expect([...ids].sort()).toEqual(ids);
  });

  it('rejects a UUID v4', () => {
    expect(isUuidV7('0b6f1d5e-3c4a-4f8e-9a2b-7c1d2e3f4a5b')).toBe(false);
  });
});
