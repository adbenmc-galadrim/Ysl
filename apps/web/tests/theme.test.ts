import { DEFAULT_THEME } from '@repo/ui';
import { describe, expect, it } from 'vitest';
import {
  readThemeSetting,
  THEME_KEY,
  writeThemeSetting,
} from '#/features/settings/theme';

function memoryStorage(initial?: string) {
  const items = new Map<string, string>();
  if (initial !== undefined) items.set(THEME_KEY, initial);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe('readThemeSetting', () => {
  it('follows the system when nothing is saved', () => {
    expect(readThemeSetting(memoryStorage())).toBe(DEFAULT_THEME);
  });

  it('reads a saved theme back', () => {
    const storage = memoryStorage();
    writeThemeSetting('sombre', storage);
    expect(readThemeSetting(storage)).toBe('sombre');
  });

  it.each(['dark', '"sombre"', ''])(
    'ignores a saved value it does not know: %s',
    (saved) => {
      expect(readThemeSetting(memoryStorage(saved))).toBe(DEFAULT_THEME);
    },
  );

  it('follows the system when storage is unreadable', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
    };
    expect(readThemeSetting(storage)).toBe(DEFAULT_THEME);
  });
});
