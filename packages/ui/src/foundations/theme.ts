/**
 * The appearances of `styles.css`. "systeme" follows the iPhone's own
 * setting and needs no attribute on `<html>`; the other two pin one.
 */
export const THEMES = [
  { value: 'systeme', title: 'Automatique', detail: 'Comme l’iPhone' },
  { value: 'clair', title: 'Clair', detail: undefined },
  { value: 'sombre', title: 'Sombre', detail: undefined },
] as const;

export type Theme = (typeof THEMES)[number]['value'];

export const DEFAULT_THEME: Theme = 'systeme';

export function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme.value === value);
}

/** What `applyTheme` needs of `<html>`: enough for a test without a DOM. */
export type ThemeRoot = { dataset: { theme?: string } };

/**
 * Writes the theme on the root element as `data-theme`, which sets
 * `color-scheme` in `styles.css`. The default removes the attribute, so the
 * stylesheet's `light dark` lets the system choose.
 */
export function applyTheme(root: ThemeRoot, theme: Theme) {
  if (theme === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = theme;
}
