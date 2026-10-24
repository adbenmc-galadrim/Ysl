import { DEFAULT_CORNERS } from '@repo/ui';
import { describe, expect, it } from 'vitest';
import {
  CORNERS_KEY,
  readCornerSetting,
  writeCornerSetting,
} from '#/features/settings/corners';

function memoryStorage(initial?: string) {
  const items = new Map<string, string>();
  if (initial !== undefined) items.set(CORNERS_KEY, initial);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe('readCornerSetting', () => {
  it('falls back to the mockup preset when nothing is saved', () => {
    expect(readCornerSetting(memoryStorage())).toEqual(DEFAULT_CORNERS);
  });

  it('reads a saved preset', () => {
    expect(
      readCornerSetting(memoryStorage('{"radius":"doux","tiles":"rondes"}')),
    ).toEqual({ radius: 'doux', tiles: 'rondes' });
  });

  it.each(['{"radius":"ovale"}', '"doux"', '{', 'null'])(
    'ignores a saved value it does not know: %s',
    (saved) => {
      expect(readCornerSetting(memoryStorage(saved))).toEqual(DEFAULT_CORNERS);
    },
  );

  it('reads back what was written', () => {
    const storage = memoryStorage();
    writeCornerSetting({ radius: 'carre', tiles: 'auto' }, storage);
    expect(readCornerSetting(storage)).toEqual({
      radius: 'carre',
      tiles: 'auto',
    });
  });
});
