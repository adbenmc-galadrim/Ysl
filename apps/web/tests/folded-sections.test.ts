import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOLDED,
  FOLDED_KEY,
  readFolded,
  toggleFolded,
  writeFolded,
} from '#/features/parcels/folded-sections';

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(FOLDED_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe('folded sections', () => {
  it('folds what went out today on a new iPhone', () => {
    expect(readFolded(memoryStorage())).toEqual(DEFAULT_FOLDED);
  });

  it('reads back what the desk folded, unknown ids dropped', () => {
    const storage = memoryStorage();
    writeFolded(['waiting'], storage);
    expect(readFolded(storage)).toEqual(['waiting']);
    expect(readFolded(memoryStorage('["late","toNotify"]'))).toEqual([
      'toNotify',
    ]);
  });

  it('keeps the default on a broken value', () => {
    expect(readFolded(memoryStorage('{oops'))).toEqual(DEFAULT_FOLDED);
    expect(readFolded(memoryStorage('"waiting"'))).toEqual(DEFAULT_FOLDED);
  });

  it('remembers an unfolded default as an empty list', () => {
    const storage = memoryStorage();
    writeFolded(toggleFolded(DEFAULT_FOLDED, 'handedOver'), storage);
    expect(readFolded(storage)).toEqual([]);
  });

  it('folds and unfolds one section', () => {
    expect(toggleFolded(['handedOver'], 'waiting')).toEqual([
      'handedOver',
      'waiting',
    ]);
    expect(toggleFolded(['handedOver', 'waiting'], 'handedOver')).toEqual([
      'waiting',
    ]);
  });
});
