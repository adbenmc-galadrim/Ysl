import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  DEFAULT_THEME,
  isTheme,
  THEMES,
  type ThemeRoot,
} from '#foundations/theme';

const css = readFileSync(resolve(import.meta.dirname, '../styles.css'), 'utf8');

describe('themes', () => {
  it('lists every theme the stylesheet pins, plus the default', () => {
    const declared = new Set([
      ...[...css.matchAll(/:root\[data-theme='([a-z]+)'\]/g)].map(
        (match) => match[1],
      ),
      DEFAULT_THEME,
    ]);
    expect(new Set(THEMES.map((theme) => theme.value))).toEqual(declared);
  });

  it('recognises a theme and rejects the rest', () => {
    expect(isTheme('sombre')).toBe(true);
    expect(isTheme('dark')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe('applyTheme', () => {
  it('removes the attribute for the default, so the system decides', () => {
    const root: ThemeRoot = { dataset: { theme: 'sombre' } };
    applyTheme(root, DEFAULT_THEME);
    expect(root.dataset).toEqual({});
  });

  it('writes a pinned theme on the root', () => {
    const root: ThemeRoot = { dataset: {} };
    applyTheme(root, 'clair');
    expect(root.dataset).toEqual({ theme: 'clair' });
  });
});
