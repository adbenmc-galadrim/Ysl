import { applyTheme, DEFAULT_THEME, isTheme, type Theme } from '@repo/ui';
import { useSyncExternalStore } from 'react';
import { paintThemeColor } from '#/features/shell/theme-color';

export const THEME_KEY = 'courrier.theme';

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The appearance saved on this device; anything unknown reads as the system's. */
export function readThemeSetting(storage: ThemeStorage = localStorage): Theme {
  try {
    const saved = storage.getItem(THEME_KEY);
    return isTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeThemeSetting(
  theme: Theme,
  storage: ThemeStorage = localStorage,
) {
  try {
    storage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

let current: Theme | undefined;
const listeners = new Set<() => void>();

/**
 * Reads the saved appearance and draws it, before the first frame, bars
 * included (`paintThemeColor`).
 */
export function bootTheme() {
  current = readThemeSetting();
  applyTheme(document.documentElement, current);
  paintThemeColor();
}

function getSnapshot() {
  current ??= readThemeSetting();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setThemeSetting(theme: Theme) {
  current = theme;
  writeThemeSetting(theme);
  applyTheme(document.documentElement, theme);
  listeners.forEach((listener) => listener());
}

export function useThemeSetting() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
